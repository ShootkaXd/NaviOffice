namespace NaviOffice.Api.Models;

/// <summary>Привязка сотрудника к помещению (кабинету).</summary>
public class RoomAssignment
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public string EmployeeLogin { get; set; } = "";
    public string AssignedBy { get; set; } = "";
    public DateTime AssignedAt { get; set; }

    public Room? Room { get; set; }
}
