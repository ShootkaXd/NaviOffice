namespace NaviOffice.Api.Models;

public class Desk
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Name { get; set; } = "";
    public double Rotation { get; set; }

    public Floor? Floor { get; set; }
    public Assignment? Assignment { get; set; }
}
