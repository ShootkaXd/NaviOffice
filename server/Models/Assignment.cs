namespace NaviOffice.Api.Models;

/// <summary>Назначение сотрудника на место. На одном месте может сидеть до двух сотрудников.</summary>
public class Assignment
{
    public Guid Id { get; set; }
    public Guid DeskId { get; set; }
    public string EmployeeLogin { get; set; } = "";
    public string AssignedBy { get; set; } = "";
    public DateTime AssignedAt { get; set; }

    public Desk? Desk { get; set; }
}
