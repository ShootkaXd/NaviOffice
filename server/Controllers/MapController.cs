using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

[ApiController]
[Route("api/map")]
[Authorize]
public class MapController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmployeeDirectory _directory;

    public MapController(AppDbContext db, IEmployeeDirectory directory)
    {
        _db = db;
        _directory = directory;
    }

    [HttpGet]
    public async Task<ActionResult<MapResponse>> GetMap()
    {
        var floors = await _db.Floors.AsNoTracking()
            .OrderBy(f => f.Order).ThenBy(f => f.Name)
            .ToListAsync();
        var rooms = await _db.Rooms.AsNoTracking().ToListAsync();
        var desks = await _db.Desks.AsNoTracking().ToListAsync();
        var assignments = await _db.Assignments.AsNoTracking().ToListAsync();

        var assignmentDtos = new Dictionary<Guid, DeskAssignmentDto>();
        foreach (var assignment in assignments)
        {
            assignmentDtos[assignment.DeskId] = await BuildAssignmentDto(_directory, assignment);
        }

        return Ok(new MapResponse
        {
            Floors = floors.Select(f => new FloorDto { Id = f.Id, Name = f.Name, Order = f.Order }).ToList(),
            Rooms = rooms.Select(ToRoomDto).ToList(),
            Desks = desks.Select(d => ToDeskDto(d,
                assignmentDtos.TryGetValue(d.Id, out var dto) ? dto : null)).ToList()
        });
    }

    internal static async Task<DeskAssignmentDto> BuildAssignmentDto(IEmployeeDirectory directory, Assignment assignment)
    {
        var employee = await directory.GetByLoginAsync(assignment.EmployeeLogin);
        return new DeskAssignmentDto
        {
            Login = assignment.EmployeeLogin,
            DisplayName = employee?.DisplayName ?? assignment.EmployeeLogin,
            Department = employee?.Department,
            Title = employee?.Title
        };
    }

    internal static RoomDto ToRoomDto(Room room) => new()
    {
        Id = room.Id,
        FloorId = room.FloorId,
        X = room.X,
        Y = room.Y,
        Width = room.Width,
        Height = room.Height,
        Name = room.Name,
        Color = room.Color,
        Capacity = room.Capacity
    };

    internal static DeskDto ToDeskDto(Desk desk, DeskAssignmentDto? assignment) => new()
    {
        Id = desk.Id,
        FloorId = desk.FloorId,
        X = desk.X,
        Y = desk.Y,
        Name = desk.Name,
        Rotation = desk.Rotation,
        Assignment = assignment
    };
}
