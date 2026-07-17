using Microsoft.Extensions.Caching.Memory;
using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

/// <summary>Caches directory lookups in memory for 10 minutes.</summary>
public class CachedEmployeeDirectory : IEmployeeDirectory
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);

    private readonly ILdapService _ldap;
    private readonly IMemoryCache _cache;

    public CachedEmployeeDirectory(ILdapService ldap, IMemoryCache cache)
    {
        _ldap = ldap;
        _cache = cache;
    }

    public async Task<IReadOnlyList<EmployeeInfo>> SearchAsync(string query, int limit)
    {
        var key = $"emp:search:{limit}:{query?.Trim().ToLowerInvariant()}";
        if (_cache.TryGetValue(key, out IReadOnlyList<EmployeeInfo>? cached) && cached != null)
        {
            return cached;
        }

        var result = await _ldap.SearchAsync(query ?? "", limit);
        _cache.Set(key, result, CacheDuration);
        return result;
    }

    public async Task<EmployeeInfo?> GetByLoginAsync(string login)
    {
        if (string.IsNullOrWhiteSpace(login))
        {
            return null;
        }

        var key = $"emp:login:{login.Trim().ToLowerInvariant()}";
        if (_cache.TryGetValue(key, out EmployeeInfo? cached) && cached != null)
        {
            return cached;
        }

        var result = await _ldap.GetByLoginAsync(login.Trim());
        if (result != null)
        {
            _cache.Set(key, result, CacheDuration);
        }

        return result;
    }

    public async Task<(byte[] Data, string ContentType)?> GetPhotoAsync(string login)
    {
        if (string.IsNullOrWhiteSpace(login))
        {
            return null;
        }

        var key = $"emp:photo:{login.Trim().ToLowerInvariant()}";
        if (_cache.TryGetValue(key, out (byte[] Data, string ContentType)? cached) && cached != null)
        {
            return cached;
        }

        var result = await _ldap.GetPhotoAsync(login.Trim());
        if (result != null)
        {
            _cache.Set(key, result, CacheDuration);
        }

        return result;
    }
}
