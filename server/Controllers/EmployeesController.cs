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
            .ToDictionaryAsync(a => a.EmployeeLogin.ToLower(), a => a.DeskId);

        var result = employees.Select(e => new EmployeeDto
        {
            Login = e.Login,
            DisplayName = e.DisplayName,
            Department = e.Department,
            Title = e.Title,
            Email = e.Email,
            DeskId = deskByLogin.TryGetValue(e.Login.ToLower(), out var deskId) ? deskId : null
        }).ToList();

        return Ok(result);
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
