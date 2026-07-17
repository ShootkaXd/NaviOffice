namespace NaviOffice.Api.Models;

public class MeetingRoom
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Почта room mailbox в Exchange; нужна для Graph-режима бронирования.</summary>
    public string? Email { get; set; }
    public int Capacity { get; set; }
    public string Color { get; set; } = "#8b5cf6";

    public Floor? Floor { get; set; }
    public List<Booking> Bookings { get; set; } = new();
}
