namespace NaviOffice.Api.Models;

public class Room
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#DBEAFE";
    public int Capacity { get; set; }

    public Floor? Floor { get; set; }
}
