using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

/// <summary>Directory backend: real LDAP or the built-in demo directory.</summary>
public interface ILdapService
{
    /// <summary>Returns employee info on success, null on invalid credentials or errors.</summary>
    Task<EmployeeInfo?> AuthenticateAsync(string username, string password);

    /// <summary>Searches by login / display name / department. Empty query returns first employees.</summary>
    Task<IReadOnlyList<EmployeeInfo>> SearchAsync(string query, int limit);

    Task<EmployeeInfo?> GetByLoginAsync(string login);

    /// <summary>Returns photo bytes and content type, or null when no photo exists.</summary>
    Task<(byte[] Data, string ContentType)?> GetPhotoAsync(string login);
}
