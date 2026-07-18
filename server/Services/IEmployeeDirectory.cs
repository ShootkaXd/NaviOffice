using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

/// <summary>Read side of the directory with in-memory caching (10 minutes).</summary>
public interface IEmployeeDirectory
{
    Task<IReadOnlyList<EmployeeInfo>> SearchAsync(string query, int limit);
    Task<EmployeeInfo?> GetByLoginAsync(string login);
    Task<(byte[] Data, string ContentType)?> GetPhotoAsync(string login);
    Task<IReadOnlyList<EmployeeInfo>> GetDirectReportsAsync(string managerLogin);
}
