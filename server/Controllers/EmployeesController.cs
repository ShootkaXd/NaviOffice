using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private const int MaxResults = 20;

    private readonly IEmployeeDirectory _directory;
    private readonly AppDbContext _db;

    public EmployeesController(IEmployeeDirectory directory, AppDbContext db)
    {
        _directory = directory;
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<EmployeeDto>>> Search([FromQuery] string? search)
    {
        var employees = await _directory.SearchAsync(search ?? "", MaxResults);

        var logins = employees.Select(e => e.Login.ToLower()).ToList();
        var deskByLogin = await _db.Assignments
            .Where(a => logins.Contains(a.EmployeeLogin.ToLower()))
            .GroupBy(a => a.EmployeeLogin.ToLower())
            .ToDictionaryAsync(g => g.Key, g => g.First().DeskId);
        var roomByLogin = await _db.RoomAssignments
            .Where(a => logins.Contains(a.EmployeeLogin.ToLower()))
            .GroupBy(a => a.EmployeeLogin.ToLower())
            .ToDictionaryAsync(g => g.Key, g => g.First().RoomId);

        var result = employees.Select(e => new EmployeeDto
        {
            Login = e.Login,
            DisplayName = e.DisplayName,
            Department = e.Department,
            Title = e.Title,
            Email = e.Email,
            DeskId = deskByLogin.TryGetValue(e.Login.ToLower(), out var deskId) ? deskId : null,
            RoomId = roomByLogin.TryGetValue(e.Login.ToLower(), out var roomId) ? roomId : null,
            ManagerLogin = e.ManagerLogin
        }).ToList();

        return Ok(result);
    }

    /// <summary>Мои прямые подчинённые (по атрибуту manager из справочника).</summary>
    [HttpGet("/api/team")]
    public async Task<ActionResult<List<TeamMemberDto>>> Team()
    {
        var me = User.FindFirst("sub")?.Value ?? "";
        var reports = await _directory.GetDirectReportsAsync(me);
        return Ok(reports.Select(e => new TeamMemberDto
        {
            Login = e.Login,
            DisplayName = e.DisplayName,
            Department = e.Department,
            Title = e.Title
        }).ToList());
    }

    [HttpGet("{login}/photo")]
    public async Task<IActionResult> Photo(string login)
    {
        var photo = await _directory.GetPhotoAsync(login);
        if (photo == null)
        {
            return NotFound();
        }

        return File(photo.Value.Data, photo.Value.ContentType);
    }
}
