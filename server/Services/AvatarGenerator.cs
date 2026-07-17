using System.Text;

namespace NaviOffice.Api.Services;

/// <summary>Generates SVG avatars with initials on a deterministic colored background.</summary>
public static class AvatarGenerator
{
    private static readonly string[] Colors =
    {
        "#4E79A7", "#F28E2B", "#E15759", "#76B7B2",
        "#59A14F", "#B6992D", "#B07AA1", "#9D7660",
        "#499894", "#D37295", "#5B6C8F", "#BAB0AC"
    };

    public static (byte[] Data, string ContentType) Generate(string login, string displayName)
    {
        var initials = GetInitials(displayName, login);
        var color = Colors[GetStableHash(login) % Colors.Length];
        var svg =
            $"<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>" +
            $"<rect width='96' height='96' rx='12' fill='{color}'/>" +
            $"<text x='48' y='60' font-family='Arial, Helvetica, sans-serif' font-size='36' font-weight='bold' " +
            $"fill='#FFFFFF' text-anchor='middle'>{initials}</text>" +
            "</svg>";
        return (Encoding.UTF8.GetBytes(svg), "image/svg+xml");
    }

    private static string GetInitials(string displayName, string login)
    {
        var parts = displayName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length >= 2)
        {
            return $"{char.ToUpperInvariant(parts[0][0])}{char.ToUpperInvariant(parts[1][0])}";
        }

        if (parts.Length == 1 && parts[0].Length > 0)
        {
            return char.ToUpperInvariant(parts[0][0]).ToString();
        }

        return login.Length > 0 ? char.ToUpperInvariant(login[0]).ToString() : "?";
    }

    private static int GetStableHash(string value)
    {
        unchecked
        {
            var hash = 17;
            foreach (var c in value.ToLowerInvariant())
            {
                hash = hash * 31 + c;
            }

            return Math.Abs(hash == int.MinValue ? 0 : hash);
        }
    }
}
