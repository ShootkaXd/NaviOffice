namespace NaviOffice.Api.Models;

/// <summary>Точечная метка на карте (принтер и т.п.).</summary>
public class Marker
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Kind { get; set; } = "printer";
    public string Label { get; set; } = "";

    public Floor? Floor { get; set; }
}
