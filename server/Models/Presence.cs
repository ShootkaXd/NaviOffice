namespace NaviOffice.Api.Models;

/// <summary>Статус посещения на конкретную дату: office | remote | dayoff.</summary>
public class Presence
{
    public Guid Id { get; set; }
    public string EmployeeLogin { get; set; } = "";
    /// <summary>Дата в формате YYYY-MM-DD (локальная).</summary>
    public string Date { get; set; } = "";
    public string Status { get; set; } = "office";
}
