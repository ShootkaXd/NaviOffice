namespace NaviOffice.Api.Models;

/// <summary>Бронь переговорной в Demo-режиме (в Graph-режиме брони живут в Exchange).</summary>
public class Booking
{
    public Guid Id { get; set; }
    public Guid MeetingRoomId { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Subject { get; set; } = "";
    public string OrganizerLogin { get; set; } = "";
    public string OrganizerName { get; set; } = "";
    /// <summary>JSON-массив имён участников; null — без участников.</summary>
    public string? AttendeesJson { get; set; }

    public MeetingRoom? MeetingRoom { get; set; }
}
