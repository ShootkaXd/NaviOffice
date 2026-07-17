using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

public class JwtTokenService
{
    /// <summary>64-char development fallback signing key (used when Jwt:Key is not configured).</summary>
    public const string DevFallbackKey = "naviofficedevkeynaviofficedevkeynaviofficedevkeynaviofficedevkey";

    private readonly string _key;
    private readonly double _expiresHours;

    public JwtTokenService(IConfiguration config)
    {
        _key = ResolveKey(config);
        _expiresHours = double.TryParse(config["Jwt:ExpiresHours"], out var hours) && hours > 0 ? hours : 12;
    }

    public static string ResolveKey(IConfiguration config)
    {
        var key = config["Jwt:Key"];
        return string.IsNullOrWhiteSpace(key) ? DevFallbackKey : key;
    }

    public string CreateToken(EmployeeInfo user)
    {
        var now = DateTime.UtcNow;
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Login),
            new(JwtRegisteredClaimNames.Name, user.DisplayName),
            new("role", user.Role),
            new("department", user.Department ?? ""),
            new("title", user.Title ?? ""),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            notBefore: now,
            expires: now.AddHours(_expiresHours),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
