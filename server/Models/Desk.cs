namespace NaviOffice.Api.Models;

public class Desk
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Name { get; set; } = "";
    public double Rotation { get; set; }
    /// <summary>Свой цвет места; null — цвет по статусу занятости.</summary>
    public string? Color { get; set; }
    /// <summary>Размер стола в единицах карты; null — стандартный 60×40.</summary>
    public double? Width { get; set; }
    public double? Height { get; set; }
    /// <summary>JSON-массив оборудования ("Монитор 27\"", "ПК" ...); null — пусто.</summary>
    public string? EquipmentJson { get; set; }

    public Floor? Floor { get; set; }
    public List<Assignment> Assignments { get; set; } = new();
}
