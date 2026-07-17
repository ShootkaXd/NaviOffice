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

        var maxOrder = await _db.Floors.Select(f => (int?)f.Order).MaxAsync() ?? 0;
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Order = maxOrder + 1
        };

        _db.Floors.Add(floor);
        await _db.SaveChangesAsync();

        return Ok(new FloorDto { Id = floor.Id, Name = floor.Name, Order = floor.Order });
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
        }

        await _db.SaveChangesAsync();

        var rooms = await _db.Rooms.AsNoTracking().Where(r => r.FloorId == id).ToListAsync();
        var desks = await _db.Desks.AsNoTracking().Where(d => d.FloorId == id).ToListAsync();
        var deskIds = desks.Select(d => d.Id).ToList();
        var assignments = await _db.Assignments.AsNoTracking()
            .Where(a => deskIds.Contains(a.DeskId))
            .ToListAsync();
        var assignmentDtos = new Dictionary<Guid, DeskAssignmentDto>();
        foreach (var assignment in assignments)
        {
            assignmentDtos[assignment.DeskId] = await MapController.BuildAssignmentDto(_directory, assignment);
        }

        return Ok(new FloorElementsResponse
        {
            Rooms = rooms.Select(MapController.ToRoomDto).ToList(),
            Desks = desks.Select(d => MapController.ToDeskDto(d,
                assignmentDtos.TryGetValue(d.Id, out var dto) ? dto : null)).ToList()
        });
    }
}
