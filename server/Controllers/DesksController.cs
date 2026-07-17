using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

[ApiController]
[Route("api/desks")]
[Authorize(Policy = "Secretary")] // Admin ИЛИ Secretary
public class DesksController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmployeeDirectory _directory;

    public DesksController(AppDbContext db, IEmployeeDirectory directory)
    {
        _db = db;
        _directory = directory;
    }

    /// <summary>Назначить сотрудника на стол. Одно место = один сотрудник; переназначение снимает сотрудника со старого места.</summary>
    [HttpPut("{id:guid}/assignment")]
    public async Task<ActionResult<DeskDto>> Assign(Guid id, [FromBody] AssignRequest request)
    {
        var desk = await _db.Desks.FindAsync(id);
        if (desk == null)
        {
            return NotFound(new { message = "Стол не найден" });
        }

        var login = request.Login?.Trim();
        if (string.IsNullOrWhiteSpace(login))
        {
            return BadRequest(new { message = "Не указан логин сотрудника" });
        }

        var employee = await _directory.GetByLoginAsync(login);
        if (employee == null)
        {
            return BadRequest(new { message = $"Сотрудник '{login}' не найден в справочнике" });
        }

        var normalizedLogin = employee.Login; // канонический логин из справочника
        var assignedBy = User.FindFirst("sub")?.Value ?? "unknown";

        // Сотрудник может занимать только одно место: снимаем со старого.
        var loginLower = normalizedLogin.ToLower();
        var previous = await _db.Assignments
            .Where(a => a.EmployeeLogin.ToLower() == loginLower && a.DeskId != id)
            .ToListAsync();
        if (previous.Count > 0)
        {
            _db.Assignments.RemoveRange(previous);
            await _db.SaveChangesAsync();
        }

        // Одно место = один сотрудник: заменяем текущее назначение стола.
        var current = await _db.Assignments.FindAsync(id);
        if (current != null)
        {
            current.EmployeeLogin = normalizedLogin;
            current.AssignedBy = assignedBy;
            current.AssignedAt = DateTime.UtcNow;
        }
        else
        {
            _db.Assignments.Add(new Assignment
            {
                DeskId = id,
                EmployeeLogin = normalizedLogin,
                AssignedBy = assignedBy,
                AssignedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        return Ok(MapController.ToDeskDto(desk, new DeskAssignmentDto
        {
            Login = normalizedLogin,
            DisplayName = employee.DisplayName,
            Department = employee.Department,
            Title = employee.Title
        }));
    }

    /// <summary>Снять сотрудника со стола.</summary>
    [HttpDelete("{id:guid}/assignment")]
    public async Task<ActionResult<DeskDto>> Unassign(Guid id)
    {
        var desk = await _db.Desks.FindAsync(id);
        if (desk == null)
        {
            return NotFound(new { message = "Стол не найден" });
        }

        var assignment = await _db.Assignments.FindAsync(id);
        if (assignment != null)
        {
            _db.Assignments.Remove(assignment);
            await _db.SaveChangesAsync();
        }

        return Ok(MapController.ToDeskDto(desk, null));
    }
}
