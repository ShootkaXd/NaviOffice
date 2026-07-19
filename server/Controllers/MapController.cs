using System.Text.Json;
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
        var offices = await _db.Offices.AsNoTracking()
            .OrderBy(o => o.Order).ThenBy(o => o.Name)
            .Select(o => new OfficeDto { Id = o.Id, Name = o.Name, Order = o.Order })
            .ToListAsync();
        var floors = await _db.Floors.AsNoTracking()
            .Select(f => new FloorDto
            {
                Id = f.Id,
                Name = f.Name,
                Order = f.Order,
                OfficeId = f.OfficeId,
                HasBackground = f.BackgroundImage != null
            })
            .OrderBy(f => f.Order).ThenBy(f => f.Name)
            .ToListAsync();
        var rooms = await _db.Rooms.AsNoTracking().ToListAsync();
        var desks = await _db.Desks.AsNoTracking().ToListAsync();
        var meetingRooms = await _db.MeetingRooms.AsNoTracking().ToListAsync();
        var markers = await _db.Markers.AsNoTracking().ToListAsync();
        var assignments = await _db.Assignments.AsNoTracking().ToListAsync();
        var roomAssignments = await _db.RoomAssignments.AsNoTracking().ToListAsync();

        var deskAssignments = new Dictionary<Guid, List<DeskAssignmentDto>>();
        foreach (var assignment in assignments)
        {
            if (!deskAssignments.TryGetValue(assignment.DeskId, out var list))
            {
                deskAssignments[assignment.DeskId] = list = new List<DeskAssignmentDto>();
            }
            list.Add(await BuildAssignmentDto(_directory, assignment.EmployeeLogin));
        }
        var roomAssignmentDtos = new Dictionary<Guid, List<DeskAssignmentDto>>();
        foreach (var assignment in roomAssignments)
        {
            if (!roomAssignmentDtos.TryGetValue(assignment.RoomId, out var list))
            {
                roomAssignmentDtos[assignment.RoomId] = list = new List<DeskAssignmentDto>();
            }
            list.Add(await BuildAssignmentDto(_directory, assignment.EmployeeLogin));
        }

        return Ok(new MapResponse
        {
            Offices = offices,
            Floors = floors,
            Rooms = rooms.Select(r => ToRoomDto(r,
                roomAssignmentDtos.TryGetValue(r.Id, out var ra) ? ra : null)).ToList(),
            Desks = desks.Select(d => ToDeskDto(d,
                deskAssignments.TryGetValue(d.Id, out var list) ? list : null)).ToList(),
            MeetingRooms = meetingRooms.Select(ToMeetingRoomDto).ToList(),
            Markers = markers.Select(ToMarkerDto).ToList()
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

    internal static async Task<DeskAssignmentDto> BuildAssignmentDto(IEmployeeDirectory directory, string login)
    {
        var employee = await directory.GetByLoginAsync(login);
        return new DeskAssignmentDto
        {
            Login = login,
            DisplayName = employee?.DisplayName ?? login,
            Department = employee?.Department,
            Title = employee?.Title
        };
    }

    internal static RoomDto ToRoomDto(Room room, List<DeskAssignmentDto>? assignments = null) => new()
    {
        Id = room.Id,
        FloorId = room.FloorId,
        X = room.X,
        Y = room.Y,
        Width = room.Width,
        Height = room.Height,
        Name = room.Name,
        Color = room.Color,
        Capacity = room.Capacity,
        Points = ParsePoints(room.PointsJson),
        Assignments = assignments ?? new List<DeskAssignmentDto>()
    };

    internal static MarkerDto ToMarkerDto(Marker marker) => new()
    {
        Id = marker.Id,
        FloorId = marker.FloorId,
        X = marker.X,
        Y = marker.Y,
        Kind = marker.Kind,
        Label = marker.Label
    };

    internal static List<PointDto>? ParsePoints(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return null;
        }
        try
        {
            var points = JsonSerializer.Deserialize<List<PointDto>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return points is { Count: >= 3 } ? points : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    internal static string? SerializePoints(List<PointDto>? points)
    {
        if (points is not { Count: >= 3 })
        {
            return null;
        }
        return JsonSerializer.Serialize(points, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
    }

    internal static DeskDto ToDeskDto(Desk desk, List<DeskAssignmentDto>? assignments) => new()
    {
        Id = desk.Id,
        FloorId = desk.FloorId,
        X = desk.X,
        Y = desk.Y,
        Name = desk.Name,
        Rotation = desk.Rotation,
        Color = desk.Color,
        Width = desk.Width,
        Height = desk.Height,
        Equipment = ParseEquipment(desk.EquipmentJson),
        Assignments = assignments ?? new List<DeskAssignmentDto>()
    };

    private static readonly JsonSerializerOptions EquipmentJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    internal static List<EquipmentItemDto> ParseEquipment(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return new List<EquipmentItemDto>();
        }
        try
        {
            using var doc = JsonDocument.Parse(json);
            var result = new List<EquipmentItemDto>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.String)
                {
                    // старый формат — просто название без инвентарного номера
                    result.Add(new EquipmentItemDto { Name = el.GetString() ?? "" });
                }
                else if (el.ValueKind == JsonValueKind.Object)
                {
                    result.Add(new EquipmentItemDto
                    {
                        Name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
                        Inv = el.TryGetProperty("inv", out var i) ? i.GetString() ?? "" : ""
                    });
                }
            }
            return result.Where(e => e.Name.Length > 0).ToList();
        }
        catch (JsonException)
        {
            return new List<EquipmentItemDto>();
        }
    }

    internal static string? SerializeEquipment(List<EquipmentItemDto>? items)
    {
        var clean = items?
            .Select(i => new EquipmentItemDto { Name = i.Name.Trim(), Inv = i.Inv.Trim() })
            .Where(i => i.Name.Length > 0)
            .Take(20)
            .ToList();
        return clean is { Count: > 0 } ? JsonSerializer.Serialize(clean, EquipmentJsonOptions) : null;
    }

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
