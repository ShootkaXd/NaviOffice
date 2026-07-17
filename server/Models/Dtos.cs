namespace NaviOffice.Api.Models;

// ---- Auth ----

public class LoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}

public class UserDto
{
    public string Login { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Department { get; set; }
    public string? Title { get; set; }
    public string Role { get; set; } = "User";
}

public class LoginResponse
{
    public string Token { get; set; } = "";
    public UserDto User { get; set; } = new();
}

// ---- Employees ----

public class EmployeeDto
{
    public string Login { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Department { get; set; }
    public string? Title { get; set; }
    public string? Email { get; set; }
    public Guid? DeskId { get; set; }
}

// ---- Map ----

public class FloorDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }
}

public class RoomDto
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "";
    public int Capacity { get; set; }
}

public class DeskAssignmentDto
{
    public string Login { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Department { get; set; }
    public string? Title { get; set; }
}

public class DeskDto
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Name { get; set; } = "";
    public double Rotation { get; set; }
    public DeskAssignmentDto? Assignment { get; set; }
}

public class MapResponse
{
    public List<FloorDto> Floors { get; set; } = new();
    public List<RoomDto> Rooms { get; set; } = new();
    public List<DeskDto> Desks { get; set; } = new();
}

// ---- Floors ----

public class CreateFloorRequest
{
    public string Name { get; set; } = "";
}

public class UpdateFloorRequest
{
    public string Name { get; set; } = "";
    public int Order { get; set; }
}

public class RoomElementDto
{
    public Guid? Id { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#DBEAFE";
    public int Capacity { get; set; }
}

public class DeskElementDto
{
    public Guid? Id { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Name { get; set; } = "";
    public double Rotation { get; set; }
}

public class FloorElementsRequest
{
    public List<RoomElementDto> Rooms { get; set; } = new();
    public List<DeskElementDto> Desks { get; set; } = new();
}

public class FloorElementsResponse
{
    public List<RoomDto> Rooms { get; set; } = new();
    public List<DeskDto> Desks { get; set; } = new();
}

// ---- Desks ----

public class AssignRequest
{
    public string Login { get; set; } = "";
}
