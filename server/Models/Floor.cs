namespace NaviOffice.Api.Models;

public class Floor
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }
    public Guid? OfficeId { get; set; }
    /// <summary>План этажа (подложка карты); null — подложки нет.</summary>
    public byte[]? BackgroundImage { get; set; }
    public string? BackgroundContentType { get; set; }

    public List<Room> Rooms { get; set; } = new();
    public List<Desk> Desks { get; set; } = new();
    public List<MeetingRoom> MeetingRooms { get; set; } = new();
}
