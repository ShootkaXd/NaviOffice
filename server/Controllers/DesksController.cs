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
    /// <summary>Максимум сотрудников на одном месте (шеринг стола).</summary>
    public const int MaxPerDesk = 2;

    private readonly AppDbContext _db;
    private readonly IEmployeeDirectory _directory;

    public DesksController(AppDbContext db, IEmployeeDirectory directory)
    {
        _db = db;
        _directory = directory;
    }

    /// <summary>
    /// Назначить сотрудника на стол (добавляется к уже сидящим, максимум двое).
    /// Сотрудник может занимать только одно место — со старого снимается.
    /// </summary>
    [HttpPut("{id:guid}/assignment")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest request)
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

        var normalizedLogin = employee.Login;
        var loginLower = normalizedLogin.ToLower();
        var assignedBy = User.FindFirst("sub")?.Value ?? "unknown";

        var deskAssignments = await _db.Assignments.Where(a => a.DeskId == id).ToListAsync();
        if (deskAssignments.Any(a => a.EmployeeLogin.ToLower() == loginLower))
        {
            return Ok(new { message = "Сотрудник уже на этом месте" });
        }
        if (deskAssignments.Count >= MaxPerDesk)
        {
            return Conflict(new { message = $"На месте уже {MaxPerDesk} сотрудника — снимите кого-нибудь" });
        }

        // Сотрудник может занимать только одно место: снимаем со старого.
        var previous = await _db.Assignments
            .Where(a => a.EmployeeLogin.ToLower() == loginLower && a.DeskId != id)
            .ToListAsync();
        _db.Assignments.RemoveRange(previous);

        _db.Assignments.Add(new Assignment
        {
            Id = Guid.NewGuid(),
            DeskId = id,
            EmployeeLogin = normalizedLogin,
            AssignedBy = assignedBy,
            AssignedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok();
    }

    /// <summary>Снять конкретного сотрудника со стола.</summary>
    [HttpDelete("{id:guid}/assignment/{login}")]
    public async Task<IActionResult> UnassignOne(Guid id, string login)
    {
        var loginLower = login.Trim().ToLower();
        var assignments = await _db.Assignments
            .Where(a => a.DeskId == id && a.EmployeeLogin.ToLower() == loginLower)
            .ToListAsync();
        _db.Assignments.RemoveRange(assignments);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Снять всех сотрудников со стола (обратная совместимость).</summary>
    [HttpDelete("{id:guid}/assignment")]
    public async Task<IActionResult> UnassignAll(Guid id)
    {
        var assignments = await _db.Assignments.Where(a => a.DeskId == id).ToListAsync();
        _db.Assignments.RemoveRange(assignments);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
