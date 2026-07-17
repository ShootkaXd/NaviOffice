namespace NaviOffice.Api.Models;

/// <summary>Employee record coming from the directory (LDAP or demo).</summary>
public class EmployeeInfo
{
    public string Login { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Department { get; set; }
    public string? Title { get; set; }
    public string? Email { get; set; }
    public string Role { get; set; } = "User";
    /// <summary>Raw photo bytes (e.g. thumbnailPhoto from AD); null when absent.</summary>
    public byte[]? Photo { get; set; }
    public string? PhotoContentType { get; set; }
}
