using Novell.Directory.Ldap;
using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

/// <summary>
/// Real LDAP/Active Directory backend (Novell.Directory.Ldap.NETStandard).
/// Configuration: Ldap:Host, Ldap:Port, Ldap:BindDnFormat, Ldap:SearchBase,
/// Ldap:AdminGroup, Ldap:SecretaryGroup, optional Ldap:ServiceUser/Ldap:ServicePassword
/// (service credentials used for directory searches; falls back to anonymous bind).
/// </summary>
public class LdapService : ILdapService
{
    private static readonly string[] Attributes =
    {
        "sAMAccountName", "uid", "displayName", "department", "title", "mail", "thumbnailPhoto", "memberOf", "manager"
    };

    private readonly string _host;
    private readonly int _port;
    private readonly string _bindDnFormat;
    private readonly string _searchBase;
    private readonly string _adminGroup;
    private readonly string _secretaryGroup;
    private readonly string? _serviceUser;
    private readonly string? _servicePassword;
    private readonly ILogger<LdapService> _logger;

    public LdapService(IConfiguration config, ILogger<LdapService> logger)
    {
        _logger = logger;
        _host = config["Ldap:Host"] ?? "localhost";
        _port = int.TryParse(config["Ldap:Port"], out var port) ? port : 389;
        _bindDnFormat = config["Ldap:BindDnFormat"] ?? "{0}";
        _searchBase = config["Ldap:SearchBase"] ?? "";
        _adminGroup = config["Ldap:AdminGroup"] ?? "";
        _secretaryGroup = config["Ldap:SecretaryGroup"] ?? "";
        _serviceUser = config["Ldap:ServiceUser"];
        _servicePassword = config["Ldap:ServicePassword"];
    }

    public async Task<EmployeeInfo?> AuthenticateAsync(string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(password))
        {
            return null;
        }

        try
        {
            using var connection = new LdapConnection();
            await connection.ConnectAsync(_host, _port);
            var bindDn = string.Format(_bindDnFormat, username);
            await connection.BindAsync(bindDn, password);

            // Authenticated: read the user's own entry with the same connection.
            var filter = $"(|(sAMAccountName={EscapeFilter(username)})(uid={EscapeFilter(username)}))";
            var results = await connection.SearchAsync(_searchBase, LdapConnection.ScopeSub, filter, Attributes, false);
            while (await results.HasMoreAsync())
            {
                LdapEntry entry;
                try
                {
                    entry = await results.NextAsync();
                }
                catch (LdapReferralException)
                {
                    continue;
                }

                return MapEntry(entry, username);
            }

            // Bind succeeded but the entry was not found in the search base.
            _logger.LogWarning("LDAP bind for {User} succeeded but no directory entry found", username);
            return new EmployeeInfo { Login = username, DisplayName = username, Role = "User" };
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP authentication failed for {User}", username);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LDAP error during authentication for {User}", username);
            return null;
        }
    }

    public async Task<IReadOnlyList<EmployeeInfo>> SearchAsync(string query, int limit)
    {
        try
        {
            using var connection = await OpenServiceConnectionAsync();
            var q = EscapeFilter(query ?? "", allowEmpty: true);
            var filter = string.IsNullOrWhiteSpace(q)
                ? "(|(sAMAccountName=*)(uid=*))"
                : $"(|(sAMAccountName=*{q}*)(displayName=*{q}*)(department=*{q}*))";

            var employees = new List<EmployeeInfo>();
            var results = await connection.SearchAsync(_searchBase, LdapConnection.ScopeSub, filter, Attributes, false);
            while (await results.HasMoreAsync() && employees.Count < limit)
            {
                LdapEntry entry;
                try
                {
                    entry = await results.NextAsync();
                }
                catch (LdapReferralException)
                {
                    continue;
                }

                var employee = MapEntry(entry, null);
                if (employee != null)
                {
                    employees.Add(employee);
                }
            }

            return employees;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LDAP search failed for query {Query}", query);
            return Array.Empty<EmployeeInfo>();
        }
    }

    public async Task<EmployeeInfo?> GetByLoginAsync(string login)
    {
        if (string.IsNullOrWhiteSpace(login))
        {
            return null;
        }

        try
        {
            using var connection = await OpenServiceConnectionAsync();
            var filter = $"(|(sAMAccountName={EscapeFilter(login)})(uid={EscapeFilter(login)}))";
            var results = await connection.SearchAsync(_searchBase, LdapConnection.ScopeSub, filter, Attributes, false);
            while (await results.HasMoreAsync())
            {
                LdapEntry entry;
                try
                {
                    entry = await results.NextAsync();
                }
                catch (LdapReferralException)
                {
                    continue;
                }

                return MapEntry(entry, login);
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LDAP lookup failed for login {Login}", login);
            return null;
        }
    }

    /// <summary>Прямые подчинённые: поиск по (manager=DN руководителя).</summary>
    public async Task<IReadOnlyList<EmployeeInfo>> GetDirectReportsAsync(string managerLogin)
    {
        try
        {
            using var connection = await OpenServiceConnectionAsync();
            var q = EscapeFilter(managerLogin, allowEmpty: false);
            var managerResults = await connection.SearchAsync(_searchBase, LdapConnection.ScopeSub,
                $"(|(sAMAccountName={q})(uid={q}))", new[] { "distinguishedName" }, false);
            if (!await managerResults.HasMoreAsync())
            {
                return Array.Empty<EmployeeInfo>();
            }
            var managerDn = (await managerResults.NextAsync()).Dn;

            var employees = new List<EmployeeInfo>();
            var results = await connection.SearchAsync(_searchBase, LdapConnection.ScopeSub,
                $"(manager={EscapeFilter(managerDn, allowEmpty: false)})", Attributes, false);
            while (await results.HasMoreAsync() && employees.Count < 100)
            {
                LdapEntry entry;
                try
                {
                    entry = await results.NextAsync();
                }
                catch (LdapReferralException)
                {
                    continue;
                }
                var employee = MapEntry(entry, null);
                if (employee != null)
                {
                    employees.Add(employee);
                }
            }
            return employees;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LDAP direct reports lookup failed for {Login}", managerLogin);
            return Array.Empty<EmployeeInfo>();
        }
    }

    public async Task<(byte[] Data, string ContentType)?> GetPhotoAsync(string login)
    {
        var employee = await GetByLoginAsync(login);
        if (employee?.Photo is { Length: > 0 })
        {
            return (employee.Photo, employee.PhotoContentType ?? "image/jpeg");
        }

        return null;
    }

    private async Task<LdapConnection> OpenServiceConnectionAsync()
    {
        var connection = new LdapConnection();
        try
        {
            await connection.ConnectAsync(_host, _port);
            if (!string.IsNullOrWhiteSpace(_serviceUser))
            {
                var bindDn = string.Format(_bindDnFormat, _serviceUser);
                await connection.BindAsync(bindDn, _servicePassword ?? "");
            }

            return connection;
        }
        catch
        {
            connection.Dispose();
            throw;
        }
    }

    private EmployeeInfo? MapEntry(LdapEntry entry, string? fallbackLogin)
    {
        try
        {
            var login = entry.GetStringValueOrDefault("sAMAccountName", null)
                        ?? entry.GetStringValueOrDefault("uid", null)
                        ?? fallbackLogin;
            if (string.IsNullOrWhiteSpace(login))
            {
                return null;
            }

            var photo = entry.GetBytesValueOrDefault("thumbnailPhoto", null);
            return new EmployeeInfo
            {
                Login = login,
                DisplayName = entry.GetStringValueOrDefault("displayName", null) ?? login,
                Department = entry.GetStringValueOrDefault("department", null),
                Title = entry.GetStringValueOrDefault("title", null),
                Email = entry.GetStringValueOrDefault("mail", null),
                Photo = photo is { Length: > 0 } ? photo : null,
                PhotoContentType = photo is { Length: > 0 } ? "image/jpeg" : null,
                Role = ResolveRole(entry)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to map LDAP entry {Dn}", entry.Dn);
            return null;
        }
    }

    private string ResolveRole(LdapEntry entry)
    {
        try
        {
            var memberOf = entry.GetOrDefault("memberOf", null)?.StringValueArray ?? Array.Empty<string>();
            if (!string.IsNullOrWhiteSpace(_adminGroup) &&
                memberOf.Any(g => string.Equals(g, _adminGroup, StringComparison.OrdinalIgnoreCase)))
            {
                return "Admin";
            }

            if (!string.IsNullOrWhiteSpace(_secretaryGroup) &&
                memberOf.Any(g => string.Equals(g, _secretaryGroup, StringComparison.OrdinalIgnoreCase)))
            {
                return "Secretary";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve role from memberOf for {Dn}", entry.Dn);
        }

        return "User";
    }

    /// <summary>Escapes special characters per RFC 4515 to prevent LDAP filter injection.</summary>
    private static string EscapeFilter(string value, bool allowEmpty = false)
    {
        if (string.IsNullOrEmpty(value))
        {
            return allowEmpty ? "" : value;
        }

        var sb = new System.Text.StringBuilder(value.Length);
        foreach (var c in value)
        {
            switch (c)
            {
                case '\\': sb.Append("\\5c"); break;
                case '*': sb.Append("\\2a"); break;
                case '(': sb.Append("\\28"); break;
                case ')': sb.Append("\\29"); break;
                case '\0': sb.Append("\\00"); break;
                default: sb.Append(c); break;
            }
        }

        return sb.ToString();
    }
}
