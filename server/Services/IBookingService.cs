using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

public enum BookingResultKind
{
    Created,
    Conflict,
    Invalid,
    Error
}

public record BookingResult(BookingResultKind Kind, string? Message = null);

/// <summary>Организатор брони (из JWT текущего пользователя).</summary>
public record BookingOrganizer(string Login, string DisplayName, string? Email);

public interface IBookingService
{
    /// <summary>Брони переговорной за день (локальные сутки date).</summary>
    Task<List<BookingItemDto>> GetScheduleAsync(MeetingRoom room, DateOnly date);

    /// <summary>Текущий статус для набора переговорных (кэшируется вызывающей стороной).</summary>
    Task<List<RoomStatusDto>> GetStatusAsync(IReadOnlyList<MeetingRoom> rooms);

    Task<BookingResult> CreateBookingAsync(MeetingRoom room, BookingOrganizer organizer, DateTime start, DateTime end, string subject);
}
