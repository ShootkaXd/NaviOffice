using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

/// <summary>Календарь посещения офиса: office | remote | dayoff по датам.</summary>
[ApiController]
[Route("api/presence")]
[Authorize]
public partial class PresenceController : ControllerBase
{
    private static readonly HashSet<string> ValidStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "office", "remote", "dayoff"
    };

    private readonly AppDbContext _db;
    private readonly IEmployeeDirectory _directory;

    public PresenceController(AppDbContext db, IEmployeeDirectory directory)
    {
        _db = db;
        _directory = directory;
    }

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")]
    private static partial Regex DateRegex();

    /// <summary>Статусы по датам. logins — через запятую; пусто = только свои.</summary>
    [HttpGet]
    public async Task<ActionResult<List<PresenceDto>>> Get(
        [FromQuery] string? logins, [FromQuery] string from, [FromQuery] string to)
    {
        if (!DateRegex().IsMatch(from) || !DateRegex().IsMatch(to))
        {
            return BadRequest(new { message = "Даты в формате YYYY-MM-DD" });
        }

        var me = User.FindFirst("sub")?.Value ?? "";
        var loginList = string.IsNullOrWhiteSpace(logins)
            ? new List<string> { me }
            : logins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Take(100).ToList();
        var loginsLower = loginList.Select(l => l.ToLower()).ToList();

        var items = await _db.Presences.AsNoTracking()
            .Where(p => loginsLower.Contains(p.EmployeeLogin.ToLower())
                && string.Compare(p.Date, from) >= 0 && string.Compare(p.Date, to) <= 0)
            .ToListAsync();

        return Ok(items.Select(p => new PresenceDto
        {
            Login = p.EmployeeLogin,
            Date = p.Date,
            Status = p.Status
        }).ToList());
    }

    /// <summary>
    /// Установить статус на дату. Себе — любой пользователь; другим — Admin/Secretary
    /// или непосредственный руководитель сотрудника.
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Set([FromBody] SetPresenceRequest request)
    {
        if (!DateRegex().IsMatch(request.Date))
        {
            return BadRequest(new { message = "Дата в формате YYYY-MM-DD" });
        }
        var status = request.Status?.Trim().ToLower() ?? "";
        if (status != "none" && !ValidStatuses.Contains(status))
        {
            return BadRequest(new { message = "Статус: office, remote, dayoff или none" });
        }

        var me = User.FindFirst("sub")?.Value ?? "";
        var role = User.FindFirst("role")?.Value ?? "User";
        var target = string.IsNullOrWhiteSpace(request.Login) ? me : request.Login.Trim();

        if (!string.Equals(target, me, StringComparison.OrdinalIgnoreCase)
            && role != "Admin" && role != "Secretary")
        {
            // Руководитель может менять статусы своих прямых подчинённых.
            var employee = await _directory.GetByLoginAsync(target);
            if (!string.Equals(employee?.ManagerLogin, me, StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }
        }

        var targetLower = target.ToLower();
        var existing = await _db.Presences
            .FirstOrDefaultAsync(p => p.EmployeeLogin.ToLower() == targetLower && p.Date == request.Date);

        if (status == "none")
        {
            if (existing != null)
            {
                _db.Presences.Remove(existing);
                await _db.SaveChangesAsync();
            }
            return NoContent();
        }

        if (existing != null)
        {
            existing.Status = status;
        }
        else
        {
            _db.Presences.Add(new Presence
            {
                Id = Guid.NewGuid(),
                EmployeeLogin = target,
                Date = request.Date,
                Status = status
            });
        }
        await _db.SaveChangesAsync();
        return Ok();
    }
}
