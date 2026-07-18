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
    public string? Email { get; set; }
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
    public bool HasBackground { get; set; }
}

public class PointDto
{
    public double X { get; set; }
    public double Y { get; set; }
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
    /// <summary>Вершины полигона; null — прямоугольник.</summary>
    public List<PointDto>? Points { get; set; }
}

public class MarkerDto
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Kind { get; set; } = "printer";
    public string Label { get; set; } = "";
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

public class MeetingRoomDto
{
    public Guid Id { get; set; }
    public Guid FloorId { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public int Capacity { get; set; }
    public string Color { get; set; } = "#8b5cf6";
}

public class MapResponse
{
    public List<FloorDto> Floors { get; set; } = new();
    public List<RoomDto> Rooms { get; set; } = new();
    public List<DeskDto> Desks { get; set; } = new();
    public List<MeetingRoomDto> MeetingRooms { get; set; } = new();
    public List<MarkerDto> Markers { get; set; } = new();
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
    public List<PointDto>? Points { get; set; }
}

public class MarkerElementDto
{
    public Guid? Id { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Kind { get; set; } = "printer";
    public string Label { get; set; } = "";
}

public class DeskElementDto
{
    public Guid? Id { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Name { get; set; } = "";
    public double Rotation { get; set; }
}

public class MeetingRoomElementDto
{
    public Guid? Id { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public int Capacity { get; set; }
    public string Color { get; set; } = "#8b5cf6";
}

public class FloorElementsRequest
{
    public List<RoomElementDto> Rooms { get; set; } = new();
    public List<DeskElementDto> Desks { get; set; } = new();
    public List<MeetingRoomElementDto> MeetingRooms { get; set; } = new();
    public List<MarkerElementDto> Markers { get; set; } = new();
}

public class FloorElementsResponse
{
    public List<RoomDto> Rooms { get; set; } = new();
    public List<DeskDto> Desks { get; set; } = new();
    public List<MeetingRoomDto> MeetingRooms { get; set; } = new();
    public List<MarkerDto> Markers { get; set; } = new();
}

// ---- Booking ----

public class RoomStatusDto
{
    public Guid Id { get; set; }
    public bool Busy { get; set; }
    /// <summary>Занята: конец текущей встречи. Свободна: начало следующей (null — сегодня встреч больше нет).</summary>
    public DateTime? Until { get; set; }
}

public class BookingItemDto
{
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Subject { get; set; } = "";
    public string Organizer { get; set; } = "";
    public List<string> Attendees { get; set; } = new();
}

public class ScheduleResponse
{
    public List<BookingItemDto> Items { get; set; } = new();
}

public class CreateBookingRequest
{
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Subject { get; set; } = "";
    /// <summary>Логины приглашённых сотрудников.</summary>
    public List<string> Attendees { get; set; } = new();
}

// ---- Desks ----

public class AssignRequest
{
    public string Login { get; set; } = "";
}
