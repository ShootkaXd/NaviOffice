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
    public Guid? RoomId { get; set; }
    public string? ManagerLogin { get; set; }
}

// ---- Map ----

public class OfficeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }
}

public class FloorDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }
    public Guid? OfficeId { get; set; }
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
    /// <summary>Сотрудники, привязанные к помещению.</summary>
    public List<DeskAssignmentDto> Assignments { get; set; } = new();
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
    public string? Color { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public List<string> Equipment { get; set; } = new();
    /// <summary>До двух сотрудников на месте.</summary>
    public List<DeskAssignmentDto> Assignments { get; set; } = new();
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
    public List<OfficeDto> Offices { get; set; } = new();
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
    public Guid? OfficeId { get; set; }
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
    public string? Color { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public List<string> Equipment { get; set; } = new();
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
    /// <summary>Имена обязательных участников.</summary>
    public List<string> Attendees { get; set; } = new();
    /// <summary>Имена необязательных участников.</summary>
    public List<string> OptionalAttendees { get; set; } = new();
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
    /// <summary>Логины обязательных участников.</summary>
    public List<string> Attendees { get; set; } = new();
    /// <summary>Логины необязательных участников.</summary>
    public List<string> OptionalAttendees { get; set; } = new();
}

// ---- Desks ----

public class AssignRequest
{
    public string Login { get; set; } = "";
}

// ---- Offices ----

public class OfficeRequest
{
    public string Name { get; set; } = "";
}

// ---- Presence (посещаемость) ----

public class PresenceDto
{
    public string Login { get; set; } = "";
    public string Date { get; set; } = "";
    /// <summary>office | remote | dayoff</summary>
    public string Status { get; set; } = "";
}

public class SetPresenceRequest
{
    /// <summary>Логин; пусто — текущий пользователь (для чужих нужны права).</summary>
    public string? Login { get; set; }
    public string Date { get; set; } = "";
    /// <summary>office | remote | dayoff | none (снять отметку)</summary>
    public string Status { get; set; } = "";
}

public class TeamMemberDto
{
    public string Login { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Department { get; set; }
    public string? Title { get; set; }
}

// ---- Отчёты ----

public class ReportsSummaryDto
{
    public int DesksTotal { get; set; }
    public int DesksOccupied { get; set; }
    public int MeetingRoomsTotal { get; set; }
    public int BookingsInPeriod { get; set; }
    public List<DayCountDto> BookingsPerDay { get; set; } = new();
    /// <summary>Посещаемость моей команды (я + прямые подчинённые) по дням.</summary>
    public List<PresenceDayDto> TeamPresence { get; set; } = new();
    public int TeamSize { get; set; }
}

public class DayCountDto
{
    public string Date { get; set; } = "";
    public int Count { get; set; }
}

public class PresenceDayDto
{
    public string Date { get; set; } = "";
    public int Office { get; set; }
    public int Remote { get; set; }
    public int DayOff { get; set; }
}
