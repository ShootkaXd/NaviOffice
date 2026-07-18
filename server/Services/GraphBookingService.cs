using System.Text;
using System.Text.Json;
using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

/// <summary>
/// Бронирование через Outlook (Microsoft Graph, app-only client credentials).
/// Требуются application-права Calendars.ReadWrite и заполненный Graph-раздел конфига.
/// Времена — локальные для часового пояса сервера (Graph получает dateTime + timeZone).
/// </summary>
public class GraphBookingService : IBookingService
{
    private const string GraphBase = "https://graph.microsoft.com/v1.0";

    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<GraphBookingService> _log;
    private readonly string _tenantId;
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _timeZone;

    private string? _token;
    private DateTime _tokenExpires = DateTime.MinValue;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);

    public GraphBookingService(IHttpClientFactory httpFactory, IConfiguration config, ILogger<GraphBookingService> log)
    {
        _httpFactory = httpFactory;
        _log = log;
        _tenantId = config["Graph:TenantId"] ?? "";
        _clientId = config["Graph:ClientId"] ?? "";
        _clientSecret = config["Graph:ClientSecret"] ?? "";
        _timeZone = config["Graph:TimeZone"] ?? TimeZoneInfo.Local.Id;
    }

    public async Task<List<BookingItemDto>> GetScheduleAsync(MeetingRoom room, DateOnly date)
    {
        if (string.IsNullOrWhiteSpace(room.Email))
        {
            return new List<BookingItemDto>();
        }

        var dayStart = date.ToDateTime(TimeOnly.MinValue);
        var items = await GetScheduleItemsAsync(room.Email, dayStart, dayStart.AddDays(1));
        return items;
    }

    public async Task<List<RoomStatusDto>> GetStatusAsync(IReadOnlyList<MeetingRoom> rooms)
    {
        var now = DateTime.Now;
        var result = new List<RoomStatusDto>();
        foreach (var room in rooms)
        {
            if (string.IsNullOrWhiteSpace(room.Email))
            {
                result.Add(new RoomStatusDto { Id = room.Id, Busy = false, Until = null });
                continue;
            }
            try
            {
                var items = await GetScheduleItemsAsync(room.Email, now.Date, now.Date.AddDays(1));
                var current = items.FirstOrDefault(i => i.Start <= now && now < i.End);
                if (current != null)
                {
                    result.Add(new RoomStatusDto { Id = room.Id, Busy = true, Until = current.End });
                }
                else
                {
                    var next = items.Where(i => i.Start > now).OrderBy(i => i.Start).FirstOrDefault();
                    result.Add(new RoomStatusDto { Id = room.Id, Busy = false, Until = next?.Start });
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Graph getSchedule failed for {Email}", room.Email);
                result.Add(new RoomStatusDto { Id = room.Id, Busy = false, Until = null });
            }
        }
        return result;
    }

    public async Task<BookingResult> CreateBookingAsync(MeetingRoom room, BookingOrganizer organizer, DateTime start, DateTime end, string subject, IReadOnlyList<BookingAttendee> attendees)
    {
        if (end <= start)
        {
            return new BookingResult(BookingResultKind.Invalid, "Время окончания должно быть позже начала");
        }
        if (end <= DateTime.Now)
        {
            return new BookingResult(BookingResultKind.Invalid, "Нельзя бронировать в прошлом");
        }
        if (string.IsNullOrWhiteSpace(room.Email))
        {
            return new BookingResult(BookingResultKind.Invalid, "У переговорной не задан email (room mailbox)");
        }
        if (string.IsNullOrWhiteSpace(organizer.Email))
        {
            return new BookingResult(BookingResultKind.Invalid, "У вашей учётной записи не задан email — бронирование через Outlook невозможно");
        }

        try
        {
            // Проверяем занятость по календарю переговорной, чтобы отдать честный 409.
            var items = await GetScheduleItemsAsync(room.Email, start.Date, start.Date.AddDays(1));
            if (items.Any(i => i.Start < end && start < i.End))
            {
                return new BookingResult(BookingResultKind.Conflict, "Это время уже занято");
            }

            // Событие в календаре сотрудника; room mailbox приглашается ресурсом и подтверждает сам.
            // Приглашённые сотрудники — required attendees, получают приглашение в Outlook.
            var attendeeList = new List<object>
            {
                new { emailAddress = new { address = room.Email, name = room.Name }, type = "resource" }
            };
            foreach (var attendee in attendees)
            {
                if (!string.IsNullOrWhiteSpace(attendee.Email))
                {
                    attendeeList.Add(new
                    {
                        emailAddress = new { address = attendee.Email, name = attendee.DisplayName },
                        type = "required"
                    });
                }
            }

            var payload = new
            {
                subject = string.IsNullOrWhiteSpace(subject) ? "Встреча" : subject.Trim(),
                start = new { dateTime = start.ToString("yyyy-MM-ddTHH:mm:ss"), timeZone = _timeZone },
                end = new { dateTime = end.ToString("yyyy-MM-ddTHH:mm:ss"), timeZone = _timeZone },
                location = new { displayName = room.Name, locationEmailAddress = room.Email },
                attendees = attendeeList
            };

            var response = await SendAsync(HttpMethod.Post,
                $"{GraphBase}/users/{Uri.EscapeDataString(organizer.Email)}/events", payload);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _log.LogError("Graph create event failed {Status}: {Body}", response.StatusCode, body);
                return new BookingResult(BookingResultKind.Error, "Outlook отклонил бронирование, обратитесь к администратору");
            }

            return new BookingResult(BookingResultKind.Created);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Graph booking failed for room {Email}", room.Email);
            return new BookingResult(BookingResultKind.Error, "Сервис Outlook недоступен");
        }
    }

    private async Task<List<BookingItemDto>> GetScheduleItemsAsync(string roomEmail, DateTime from, DateTime to)
    {
        var payload = new
        {
            schedules = new[] { roomEmail },
            startTime = new { dateTime = from.ToString("yyyy-MM-ddTHH:mm:ss"), timeZone = _timeZone },
            endTime = new { dateTime = to.ToString("yyyy-MM-ddTHH:mm:ss"), timeZone = _timeZone },
            availabilityViewInterval = 15
        };

        var response = await SendAsync(HttpMethod.Post,
            $"{GraphBase}/users/{Uri.EscapeDataString(roomEmail)}/calendar/getSchedule", payload);
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var items = new List<BookingItemDto>();
        foreach (var schedule in doc.RootElement.GetProperty("value").EnumerateArray())
        {
            if (!schedule.TryGetProperty("scheduleItems", out var scheduleItems))
            {
                continue;
            }
            foreach (var item in scheduleItems.EnumerateArray())
            {
                var status = item.TryGetProperty("status", out var s) ? s.GetString() : "busy";
                if (status is "free" or "workingElsewhere")
                {
                    continue;
                }
                items.Add(new BookingItemDto
                {
                    Start = ParseGraphTime(item.GetProperty("start")),
                    End = ParseGraphTime(item.GetProperty("end")),
                    Subject = item.TryGetProperty("subject", out var subj) ? subj.GetString() ?? "" : "Занято",
                    Organizer = ""
                });
            }
        }
        return items.OrderBy(i => i.Start).ToList();
    }

    private static DateTime ParseGraphTime(JsonElement element)
    {
        // getSchedule возвращает время в запрошенном timeZone.
        var raw = element.GetProperty("dateTime").GetString() ?? "";
        return DateTime.Parse(raw);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object payload)
    {
        var token = await GetTokenAsync();
        var client = _httpFactory.CreateClient("graph");
        var request = new HttpRequestMessage(method, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request);
    }

    private async Task<string> GetTokenAsync()
    {
        if (_token != null && DateTime.UtcNow < _tokenExpires)
        {
            return _token;
        }

        await _tokenLock.WaitAsync();
        try
        {
            if (_token != null && DateTime.UtcNow < _tokenExpires)
            {
                return _token;
            }

            var client = _httpFactory.CreateClient("graph");
            var response = await client.PostAsync(
                $"https://login.microsoftonline.com/{_tenantId}/oauth2/v2.0/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = _clientId,
                    ["client_secret"] = _clientSecret,
                    ["scope"] = "https://graph.microsoft.com/.default",
                    ["grant_type"] = "client_credentials"
                }));
            response.EnsureSuccessStatusCode();

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            _token = doc.RootElement.GetProperty("access_token").GetString();
            var expiresIn = doc.RootElement.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600;
            _tokenExpires = DateTime.UtcNow.AddSeconds(expiresIn - 120);
            return _token!;
        }
        finally
        {
            _tokenLock.Release();
        }
    }
}
