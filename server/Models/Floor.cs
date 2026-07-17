namespace NaviOffice.Api.Models;

public class Floor
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }

    public List<Room> Rooms { get; set; } = new();
    public List<Desk> Desks { get; set; } = new();
}
