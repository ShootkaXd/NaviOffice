namespace NaviOffice.Api.Models;

public class Assignment
{
    /// <summary>Primary key and FK to Desk (one desk = one assignment).</summary>
    public Guid DeskId { get; set; }
    public string EmployeeLogin { get; set; } = "";
    public string AssignedBy { get; set; } = "";
    public DateTime AssignedAt { get; set; }

    public Desk? Desk { get; set; }
}
