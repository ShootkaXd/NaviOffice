using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

/// <summary>
/// Брони в локальной SQLite. Все времена — локальное время сервера (Kind=Unspecified),
/// клиент шлёт ISO-строки без смещения.
/// </summary>
public class DemoBookingService : IBookingService
{
    private readonly AppDbContext _db;

    public DemoBookingService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<BookingItemDto>> GetScheduleAsync(MeetingRoom room, DateOnly date)
    {
        var dayStart = date.ToDateTime(TimeOnly.MinValue);
        var dayEnd = dayStart.AddDays(1);

        var bookings = await _db.Bookings.AsNoTracking()
            .Where(b => b.MeetingRoomId == room.Id && b.Start < dayEnd && b.End > dayStart)
            .OrderBy(b => b.Start)
            .ToListAsync();

        return bookings.Select(b => new BookingItemDto
        {
            Start = b.Start,
            End = b.End,
            Subject = b.Subject,
            Organizer = b.OrganizerName,
            Attendees = ParseAttendees(b.AttendeesJson)
        }).ToList();
    }

    public async Task<List<RoomStatusDto>> GetStatusAsync(IReadOnlyList<MeetingRoom> rooms)
    {
        var now = DateTime.Now;
        var dayEnd = now.Date.AddDays(1);
        var roomIds = rooms.Select(r => r.Id).ToList();

        var todays = await _db.Bookings.AsNoTracking()
            .Where(b => roomIds.Contains(b.MeetingRoomId) && b.End > now && b.Start < dayEnd)
            .OrderBy(b => b.Start)
            .ToListAsync();

        var byRoom = todays.ToLookup(b => b.MeetingRoomId);
        return rooms.Select(room =>
        {
            var current = byRoom[room.Id].FirstOrDefault(b => b.Start <= now && now < b.End);
            if (current != null)
            {
                return new RoomStatusDto { Id = room.Id, Busy = true, Until = current.End };
            }
            var next = byRoom[room.Id].FirstOrDefault(b => b.Start > now);
            return new RoomStatusDto { Id = room.Id, Busy = false, Until = next?.Start };
        }).ToList();
    }

    public async Task<BookingResult> CreateBookingAsync(MeetingRoom room, BookingOrganizer organizer, DateTime start, DateTime end, string subject, IReadOnlyList<BookingAttendee> attendees)
    {
        if (end <= start)
        {
            return new BookingResult(BookingResultKind.Invalid, "Время окончания должно быть позже начала");
        }
        if (end <= DateTime.Now)
        {
            return new BookingResult(BookingResultKind.Invalid, "Нельзя бронировать в прошлом");
        }

        var overlaps = await _db.Bookings
            .AnyAsync(b => b.MeetingRoomId == room.Id && b.Start < end && start < b.End);
        if (overlaps)
        {
            return new BookingResult(BookingResultKind.Conflict, "Это время уже занято");
        }

        _db.Bookings.Add(new Booking
        {
            Id = Guid.NewGuid(),
            MeetingRoomId = room.Id,
            Start = start,
            End = end,
            Subject = string.IsNullOrWhiteSpace(subject) ? "Встреча" : subject.Trim(),
            OrganizerLogin = organizer.Login,
            OrganizerName = organizer.DisplayName,
            AttendeesJson = attendees.Count > 0
                ? JsonSerializer.Serialize(attendees.Select(a => a.DisplayName).ToList())
                : null
        });
        await _db.SaveChangesAsync();

        return new BookingResult(BookingResultKind.Created);
    }

    private static List<string> ParseAttendees(string? json)
    {
        if (string.IsNullOrEmpty(json))
        {
            return new List<string>();
        }
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }
}
