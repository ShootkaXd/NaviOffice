namespace NaviOffice.Api.Models;

public class Office
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }

    public List<Floor> Floors { get; set; } = new();
}
