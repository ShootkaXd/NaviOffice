using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

/// <summary>Привязка сотрудников к помещениям (кабинетам).</summary>
[ApiController]
[Route("api/rooms")]
[Authorize(Policy = "Secretary")] // Admin ИЛИ Secretary
public class RoomsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmployeeDirectory _directory;

    public RoomsController(AppDbContext db, IEmployeeDirectory directory)
    {
        _db = db;
        _directory = directory;
    }

    [HttpPut("{id:guid}/assignment")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest request)
    {
        var room = await _db.Rooms.FindAsync(id);
        if (room == null)
        {
            return NotFound(new { message = "Помещение не найдено" });
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

        var loginLower = employee.Login.ToLower();
        var exists = await _db.RoomAssignments
            .AnyAsync(a => a.RoomId == id && a.EmployeeLogin.ToLower() == loginLower);
        if (exists)
        {
            return Ok(new { message = "Сотрудник уже привязан к этому помещению" });
        }

        // Сотрудник привязывается только к одному помещению — старую привязку снимаем.
        var previous = await _db.RoomAssignments
            .Where(a => a.EmployeeLogin.ToLower() == loginLower)
            .ToListAsync();
        _db.RoomAssignments.RemoveRange(previous);

        _db.RoomAssignments.Add(new RoomAssignment
        {
            Id = Guid.NewGuid(),
            RoomId = id,
            EmployeeLogin = employee.Login,
            AssignedBy = User.FindFirst("sub")?.Value ?? "unknown",
            AssignedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id:guid}/assignment/{login}")]
    public async Task<IActionResult> Unassign(Guid id, string login)
    {
        var loginLower = login.Trim().ToLower();
        var assignments = await _db.RoomAssignments
            .Where(a => a.RoomId == id && a.EmployeeLogin.ToLower() == loginLower)
            .ToListAsync();
        _db.RoomAssignments.RemoveRange(assignments);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
