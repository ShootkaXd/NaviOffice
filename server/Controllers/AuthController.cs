using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NaviOffice.Api.Models;
using NaviOffice.Api.Services;

namespace NaviOffice.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ILdapService _ldap;
    private readonly IEmployeeDirectory _directory;
    private readonly JwtTokenService _tokens;

    public AuthController(ILdapService ldap, IEmployeeDirectory directory, JwtTokenService tokens)
    {
        _ldap = ldap;
        _directory = directory;
        _tokens = tokens;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
        {
            return Unauthorized(new { message = "Неверный логин или пароль" });
        }

        var user = await _ldap.AuthenticateAsync(request.Username.Trim(), request.Password);
        if (user == null)
        {
            return Unauthorized(new { message = "Неверный логин или пароль" });
        }

        var token = _tokens.CreateToken(user);
        return Ok(new LoginResponse
        {
            Token = token,
            User = ToUserDto(user)
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var login = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(login))
        {
            return Unauthorized();
        }

        var role = User.FindFirst("role")?.Value ?? "User";
        var employee = await _directory.GetByLoginAsync(login);
        if (employee != null)
        {
            var dto = ToUserDto(employee);
            dto.Role = role; // роль — из токена (в т.ч. когда справочник недоступен)
            return Ok(dto);
        }

        return Ok(new UserDto
        {
            Login = login,
            DisplayName = User.FindFirst("name")?.Value ?? login,
            Department = EmptyToNull(User.FindFirst("department")?.Value),
            Title = EmptyToNull(User.FindFirst("title")?.Value),
            Email = EmptyToNull(User.FindFirst("email")?.Value),
            Role = role
        });
    }

    private static UserDto ToUserDto(EmployeeInfo user) => new()
    {
        Login = user.Login,
        DisplayName = user.DisplayName,
        Department = user.Department,
        Title = user.Title,
        Email = user.Email,
        Role = user.Role
    };

    private static string? EmptyToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
