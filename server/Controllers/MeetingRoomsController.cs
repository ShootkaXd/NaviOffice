using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

[ApiController]
[Route("api/meetingrooms")]
[Authorize]
public class MeetingRoomsController : ControllerBase
{
    private const string StatusCacheKey = "meetingrooms:status";

    private readonly AppDbContext _db;
    private readonly IBookingService _booking;
    private readonly IMemoryCache _cache;

    public MeetingRoomsController(AppDbContext db, IBookingService booking, IMemoryCache cache)
    {
        _db = db;
        _booking = booking;
        _cache = cache;
    }

    [HttpGet("status")]
    public async Task<ActionResult<List<RoomStatusDto>>> Status()
    {
        if (_cache.TryGetValue(StatusCacheKey, out List<RoomStatusDto>? cached) && cached != null)
        {
            return Ok(cached);
        }

        var rooms = await _db.MeetingRooms.AsNoTracking().ToListAsync();
        var statuses = await _booking.GetStatusAsync(rooms);
        _cache.Set(StatusCacheKey, statuses, TimeSpan.FromSeconds(60));
        return Ok(statuses);
    }

    [HttpGet("{id:guid}/schedule")]
    public async Task<ActionResult<ScheduleResponse>> Schedule(Guid id, [FromQuery] string? date)
    {
        var room = await _db.MeetingRooms.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
        if (room == null)
        {
            return NotFound();
        }

        DateOnly day;
        if (string.IsNullOrWhiteSpace(date))
        {
            day = DateOnly.FromDateTime(DateTime.Now);
        }
        else if (!DateOnly.TryParse(date, out day))
        {
            return BadRequest(new { message = "Неверный формат даты, ожидается YYYY-MM-DD" });
        }

        var items = await _booking.GetScheduleAsync(room, day);
        return Ok(new ScheduleResponse { Items = items });
    }

    [HttpPost("{id:guid}/bookings")]
    public async Task<IActionResult> CreateBooking(Guid id, [FromBody] CreateBookingRequest request)
    {
        var room = await _db.MeetingRooms.FirstOrDefaultAsync(m => m.Id == id);
        if (room == null)
        {
            return NotFound();
        }

        var organizer = new BookingOrganizer(
            User.FindFirst("sub")?.Value ?? "",
            User.FindFirst("name")?.Value ?? "",
            User.FindFirst("email")?.Value);

        var result = await _booking.CreateBookingAsync(room, organizer, request.Start, request.End, request.Subject);
        _cache.Remove(StatusCacheKey);

        return result.Kind switch
        {
            BookingResultKind.Created => StatusCode(StatusCodes.Status201Created, new { message = "Забронировано" }),
            BookingResultKind.Conflict => Conflict(new { message = result.Message }),
            BookingResultKind.Invalid => BadRequest(new { message = result.Message }),
            _ => StatusCode(StatusCodes.Status502BadGateway, new { message = result.Message })
        };
    }
}
