using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

[ApiController]
[Route("api/floors")]
[Authorize(Policy = "Admin")]
public class FloorsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmployeeDirectory _directory;

    public FloorsController(AppDbContext db, IEmployeeDirectory directory)
    {
        _db = db;
        _directory = directory;
    }

    [HttpPost]
    public async Task<ActionResult<FloorDto>> Create([FromBody] CreateFloorRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Название этажа обязательно" });
        }

        var officeId = request.OfficeId
            ?? (await _db.Offices.OrderBy(o => o.Order).Select(o => (Guid?)o.Id).FirstOrDefaultAsync());
        var maxOrder = await _db.Floors.Select(f => (int?)f.Order).MaxAsync() ?? 0;
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Order = maxOrder + 1,
            OfficeId = officeId
        };

        _db.Floors.Add(floor);
        await _db.SaveChangesAsync();

        return Ok(new FloorDto { Id = floor.Id, Name = floor.Name, Order = floor.Order, OfficeId = floor.OfficeId });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FloorDto>> Update(Guid id, [FromBody] UpdateFloorRequest request)
    {
        var floor = await _db.Floors.FindAsync(id);
        if (floor == null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Название этажа обязательно" });
        }

        floor.Name = request.Name.Trim();
        floor.Order = request.Order;
        await _db.SaveChangesAsync();

        return Ok(new FloorDto { Id = floor.Id, Name = floor.Name, Order = floor.Order });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var floor = await _db.Floors.FindAsync(id);
        if (floor == null)
        {
            return NotFound();
        }

        // Assignments каскадно удаляются вместе со столами, столы и комнаты — вместе с этажом.
        _db.Floors.Remove(floor);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Bulk-замена элементов этажа. Существующие id сохраняются (вместе с назначениями),
    /// элементы, отсутствующие в запросе, удаляются (для столов — с их назначениями).
    /// </summary>
    [HttpPut("{id:guid}/elements")]
    public async Task<ActionResult<FloorElementsResponse>> ReplaceElements(Guid id, [FromBody] FloorElementsRequest request)
    {
        var floor = await _db.Floors.FindAsync(id);
        if (floor == null)
        {
            return NotFound();
        }

        var existingRooms = await _db.Rooms.Where(r => r.FloorId == id).ToListAsync();
        var existingDesks = await _db.Desks.Where(d => d.FloorId == id).ToListAsync();
        var existingMeetingRooms = await _db.MeetingRooms.Where(m => m.FloorId == id).ToListAsync();
        var existingMarkers = await _db.Markers.Where(m => m.FloorId == id).ToListAsync();

        // --- Rooms ---
        var keptRoomIds = request.Rooms
            .Where(r => r.Id.HasValue)
            .Select(r => r.Id!.Value)
            .ToHashSet();
        _db.Rooms.RemoveRange(existingRooms.Where(r => !keptRoomIds.Contains(r.Id)));

        var roomsById = existingRooms.ToDictionary(r => r.Id);
        foreach (var dto in request.Rooms)
        {
            Room room;
            if (dto.Id.HasValue && roomsById.TryGetValue(dto.Id.Value, out var existing))
            {
                room = existing;
            }
            else
            {
                room = new Room { Id = dto.Id ?? Guid.NewGuid(), FloorId = id };
                _db.Rooms.Add(room);
            }

            room.X = dto.X;
            room.Y = dto.Y;
            room.Width = dto.Width;
            room.Height = dto.Height;
            room.Name = dto.Name;
            room.Color = dto.Color;
            room.Capacity = dto.Capacity;
            room.PointsJson = MapController.SerializePoints(dto.Points);
        }

        // --- Desks ---
        var keptDeskIds = request.Desks
            .Where(d => d.Id.HasValue)
            .Select(d => d.Id!.Value)
            .ToHashSet();
        var removedDesks = existingDesks.Where(d => !keptDeskIds.Contains(d.Id)).ToList();
        if (removedDesks.Count > 0)
        {
            var removedIds = removedDesks.Select(d => d.Id).ToList();
            var removedAssignments = await _db.Assignments
                .Where(a => removedIds.Contains(a.DeskId))
                .ToListAsync();
            _db.Assignments.RemoveRange(removedAssignments);
            _db.Desks.RemoveRange(removedDesks);
        }

        var desksById = existingDesks.ToDictionary(d => d.Id);
        foreach (var dto in request.Desks)
        {
            Desk desk;
            if (dto.Id.HasValue && desksById.TryGetValue(dto.Id.Value, out var existing))
            {
                desk = existing;
            }
            else
            {
                desk = new Desk { Id = dto.Id ?? Guid.NewGuid(), FloorId = id };
                _db.Desks.Add(desk);
            }

            desk.X = dto.X;
            desk.Y = dto.Y;
            desk.Name = dto.Name;
            desk.Rotation = dto.Rotation;
            desk.Color = string.IsNullOrWhiteSpace(dto.Color) ? null : dto.Color;
        }

        // --- Meeting rooms (брони сохранившихся переговорных не трогаем; удалённые каскадно чистят брони) ---
        var keptMeetingRoomIds = request.MeetingRooms
            .Where(m => m.Id.HasValue)
            .Select(m => m.Id!.Value)
            .ToHashSet();
        _db.MeetingRooms.RemoveRange(existingMeetingRooms.Where(m => !keptMeetingRoomIds.Contains(m.Id)));

        var meetingRoomsById = existingMeetingRooms.ToDictionary(m => m.Id);
        foreach (var dto in request.MeetingRooms)
        {
            MeetingRoom meetingRoom;
            if (dto.Id.HasValue && meetingRoomsById.TryGetValue(dto.Id.Value, out var existing))
            {
                meetingRoom = existing;
            }
            else
            {
                meetingRoom = new MeetingRoom { Id = dto.Id ?? Guid.NewGuid(), FloorId = id };
                _db.MeetingRooms.Add(meetingRoom);
            }

            meetingRoom.X = dto.X;
            meetingRoom.Y = dto.Y;
            meetingRoom.Width = dto.Width;
            meetingRoom.Height = dto.Height;
            meetingRoom.Name = dto.Name;
            meetingRoom.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
            meetingRoom.Capacity = dto.Capacity;
            meetingRoom.Color = dto.Color;
        }

        // --- Markers ---
        var keptMarkerIds = request.Markers
            .Where(m => m.Id.HasValue)
            .Select(m => m.Id!.Value)
            .ToHashSet();
        _db.Markers.RemoveRange(existingMarkers.Where(m => !keptMarkerIds.Contains(m.Id)));

        var markersById = existingMarkers.ToDictionary(m => m.Id);
        foreach (var dto in request.Markers)
        {
            Marker marker;
            if (dto.Id.HasValue && markersById.TryGetValue(dto.Id.Value, out var existing))
            {
                marker = existing;
            }
            else
            {
                marker = new Marker { Id = dto.Id ?? Guid.NewGuid(), FloorId = id };
                _db.Markers.Add(marker);
            }

            marker.X = dto.X;
            marker.Y = dto.Y;
            marker.Kind = string.IsNullOrWhiteSpace(dto.Kind) ? "printer" : dto.Kind;
            marker.Label = dto.Label;
        }

        await _db.SaveChangesAsync();

        var rooms = await _db.Rooms.AsNoTracking().Where(r => r.FloorId == id).ToListAsync();
        var desks = await _db.Desks.AsNoTracking().Where(d => d.FloorId == id).ToListAsync();
        var meetingRooms = await _db.MeetingRooms.AsNoTracking().Where(m => m.FloorId == id).ToListAsync();
        var savedMarkers = await _db.Markers.AsNoTracking().Where(m => m.FloorId == id).ToListAsync();
        var deskIds = desks.Select(d => d.Id).ToList();
        var assignments = await _db.Assignments.AsNoTracking()
            .Where(a => deskIds.Contains(a.DeskId))
            .ToListAsync();
        var assignmentDtos = new Dictionary<Guid, List<DeskAssignmentDto>>();
        foreach (var assignment in assignments)
        {
            if (!assignmentDtos.TryGetValue(assignment.DeskId, out var list))
            {
                assignmentDtos[assignment.DeskId] = list = new List<DeskAssignmentDto>();
            }
            list.Add(await MapController.BuildAssignmentDto(_directory, assignment.EmployeeLogin));
        }

        return Ok(new FloorElementsResponse
        {
            Rooms = rooms.Select(r => MapController.ToRoomDto(r)).ToList(),
            Desks = desks.Select(d => MapController.ToDeskDto(d,
                assignmentDtos.TryGetValue(d.Id, out var dto) ? dto : null)).ToList(),
            MeetingRooms = meetingRooms.Select(MapController.ToMeetingRoomDto).ToList(),
            Markers = savedMarkers.Select(MapController.ToMarkerDto).ToList()
        });
    }

    // ---- План этажа (подложка) ----

    private static readonly Dictionary<string, string> AllowedBackgroundTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/png"] = "image/png",
        ["image/jpeg"] = "image/jpeg",
        ["image/jpg"] = "image/jpeg",
        ["image/svg+xml"] = "image/svg+xml"
    };

    private const long MaxBackgroundBytes = 10 * 1024 * 1024;

    // GET подложки — в MapController: атрибуты [Authorize] аддитивны,
    // и внутри этого контроллера эндпоинт требовал бы роль Admin.

    [HttpPut("{id:guid}/background")]
    [RequestSizeLimit(MaxBackgroundBytes + 1024)]
    public async Task<IActionResult> UploadBackground(Guid id, IFormFile? file)
    {
        var floor = await _db.Floors.FindAsync(id);
        if (floor == null)
        {
            return NotFound();
        }
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Файл не передан" });
        }
        if (file.Length > MaxBackgroundBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge,
                new { message = "Файл больше 10 МБ" });
        }
        if (!AllowedBackgroundTypes.TryGetValue(file.ContentType, out var storedType))
        {
            return StatusCode(StatusCodes.Status415UnsupportedMediaType,
                new { message = "Поддерживаются PNG, JPEG и SVG" });
        }

        using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        floor.BackgroundImage = stream.ToArray();
        floor.BackgroundContentType = storedType;
        await _db.SaveChangesAsync();

        return Ok();
    }

    [HttpDelete("{id:guid}/background")]
    public async Task<IActionResult> DeleteBackground(Guid id)
    {
        var floor = await _db.Floors.FindAsync(id);
        if (floor == null)
        {
            return NotFound();
        }

        floor.BackgroundImage = null;
        floor.BackgroundContentType = null;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
