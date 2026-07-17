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
            .Select(f => new FloorDto
            {
                Id = f.Id,
                Name = f.Name,
                Order = f.Order,
                HasBackground = f.BackgroundImage != null
            })
            .OrderBy(f => f.Order).ThenBy(f => f.Name)
            .ToListAsync();
        var rooms = await _db.Rooms.AsNoTracking().ToListAsync();
        var desks = await _db.Desks.AsNoTracking().ToListAsync();
        var meetingRooms = await _db.MeetingRooms.AsNoTracking().ToListAsync();
        var assignments = await _db.Assignments.AsNoTracking().ToListAsync();

        var assignmentDtos = new Dictionary<Guid, DeskAssignmentDto>();
        foreach (var assignment in assignments)
        {
            assignmentDtos[assignment.DeskId] = await BuildAssignmentDto(_directory, assignment);
        }

        return Ok(new MapResponse
        {
            Floors = floors,
            Rooms = rooms.Select(ToRoomDto).ToList(),
            Desks = desks.Select(d => ToDeskDto(d,
                assignmentDtos.TryGetValue(d.Id, out var dto) ? dto : null)).ToList(),
            MeetingRooms = meetingRooms.Select(ToMeetingRoomDto).ToList()
        });
    }

    /// <summary>План этажа; в MapController, чтобы был доступен любой роли (FloorsController требует Admin).</summary>
    [HttpGet("/api/floors/{id:guid}/background")]
    public async Task<IActionResult> GetFloorBackground(Guid id)
    {
        var floor = await _db.Floors.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);
        if (floor?.BackgroundImage == null || floor.BackgroundContentType == null)
        {
            return NotFound();
        }

        return File(floor.BackgroundImage, floor.BackgroundContentType);
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

    internal static MeetingRoomDto ToMeetingRoomDto(MeetingRoom room) => new()
    {
        Id = room.Id,
        FloorId = room.FloorId,
        X = room.X,
        Y = room.Y,
        Width = room.Width,
        Height = room.Height,
        Name = room.Name,
        Email = room.Email,
        Capacity = room.Capacity,
        Color = room.Color
    };
}
