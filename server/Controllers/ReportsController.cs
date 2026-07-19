using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

/// <summary>Сводка для страницы отчётов. Посещаемость — только по своей команде.</summary>
[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmployeeDirectory _directory;

    public ReportsController(AppDbContext db, IEmployeeDirectory directory)
    {
        _db = db;
        _directory = directory;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ReportsSummaryDto>> Summary([FromQuery] string from, [FromQuery] string to)
    {
        if (!DateOnly.TryParse(from, out var fromDate) || !DateOnly.TryParse(to, out var toDate) || toDate < fromDate
            || toDate.DayNumber - fromDate.DayNumber > 92)
        {
            return BadRequest(new { message = "Период: даты YYYY-MM-DD, не более 92 дней" });
        }

        var desksTotal = await _db.Desks.CountAsync();
        var desksOccupied = await _db.Assignments.Select(a => a.DeskId).Distinct().CountAsync();
        var meetingRoomsTotal = await _db.MeetingRooms.CountAsync();

        // Брони переговорных по дням (Demo-режим; в Graph-режиме данные живут в Exchange).
        var periodStart = fromDate.ToDateTime(TimeOnly.MinValue);
        var periodEnd = toDate.ToDateTime(TimeOnly.MinValue).AddDays(1);
        var bookings = await _db.Bookings.AsNoTracking()
            .Where(b => b.Start >= periodStart && b.Start < periodEnd)
            .Select(b => b.Start)
            .ToListAsync();
        var bookingsPerDay = bookings
            .GroupBy(s => DateOnly.FromDateTime(s))
            .ToDictionary(g => g.Key, g => g.Count());

        // Посещаемость команды: только я + мои прямые подчинённые (та же приватность, что и у графика).
        var me = User.FindFirst("sub")?.Value ?? "";
        var teamLogins = new List<string> { me };
        teamLogins.AddRange((await _directory.GetDirectReportsAsync(me)).Select(e => e.Login));
        var teamLower = teamLogins.Select(l => l.ToLower()).ToList();

        var presences = await _db.Presences.AsNoTracking()
            .Where(p => teamLower.Contains(p.EmployeeLogin.ToLower())
                && string.Compare(p.Date, from) >= 0 && string.Compare(p.Date, to) <= 0)
            .ToListAsync();

        var result = new ReportsSummaryDto
        {
            DesksTotal = desksTotal,
            DesksOccupied = desksOccupied,
            MeetingRoomsTotal = meetingRoomsTotal,
            BookingsInPeriod = bookings.Count,
            TeamSize = teamLogins.Count
        };
        for (var d = fromDate; d <= toDate; d = d.AddDays(1))
        {
            var iso = d.ToString("yyyy-MM-dd");
            result.BookingsPerDay.Add(new DayCountDto
            {
                Date = iso,
                Count = bookingsPerDay.TryGetValue(d, out var c) ? c : 0
            });
            var day = presences.Where(p => p.Date == iso).ToList();
            result.TeamPresence.Add(new PresenceDayDto
            {
                Date = iso,
                Office = day.Count(p => p.Status == "office"),
                Remote = day.Count(p => p.Status == "remote"),
                DayOff = day.Count(p => p.Status == "dayoff")
            });
        }

        return Ok(result);
    }
}
