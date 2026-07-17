using NaviOffice.Api.Models;

namespace NaviOffice.Api.Services;

/// <summary>
/// Built-in demo directory: hardcoded Russian employees plus admin/secretary/user accounts.
/// Every account authenticates with the password "demo". Photos are generated SVG avatars.
/// </summary>
public class DemoLdapService : ILdapService
{
    private const string DemoPassword = "demo";

    private static readonly List<EmployeeInfo> Employees = new()
    {
        new EmployeeInfo { Login = "admin", DisplayName = "Администратор Системы", Department = "ИТ", Title = "Системный администратор", Email = "admin@navioffice.local", Role = "Admin" },
        new EmployeeInfo { Login = "secretary", DisplayName = "Орлова Виктория Сергеевна", Department = "HR", Title = "Секретарь", Email = "secretary@navioffice.local", Role = "Secretary" },
        new EmployeeInfo { Login = "user", DisplayName = "Демидов Пользователь Иванович", Department = "ИТ", Title = "Специалист", Email = "user@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "ivanov.p", DisplayName = "Иванов Пётр Сергеевич", Department = "ИТ", Title = "Ведущий разработчик", Email = "ivanov.p@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "petrova.a", DisplayName = "Петрова Анна Владимировна", Department = "Бухгалтерия", Title = "Главный бухгалтер", Email = "petrova.a@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "sidorov.a", DisplayName = "Сидоров Алексей Николаевич", Department = "ИТ", Title = "DevOps-инженер", Email = "sidorov.a@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "kuznetsova.m", DisplayName = "Кузнецова Мария Игоревна", Department = "HR", Title = "Менеджер по персоналу", Email = "kuznetsova.m@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "smirnov.d", DisplayName = "Смирнов Дмитрий Андреевич", Department = "Продажи", Title = "Менеджер по продажам", Email = "smirnov.d@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "volkova.e", DisplayName = "Волкова Елена Павловна", Department = "Маркетинг", Title = "Маркетолог", Email = "volkova.e@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "fedorov.i", DisplayName = "Фёдоров Игорь Викторович", Department = "ИТ", Title = "Разработчик", Email = "fedorov.i@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "morozova.o", DisplayName = "Морозова Ольга Дмитриевна", Department = "Бухгалтерия", Title = "Бухгалтер", Email = "morozova.o@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "nikolaev.s", DisplayName = "Николаев Сергей Александрович", Department = "Продажи", Title = "Руководитель отдела продаж", Email = "nikolaev.s@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "pavlova.t", DisplayName = "Павлова Татьяна Юрьевна", Department = "HR", Title = "Рекрутер", Email = "pavlova.t@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "sokolov.a", DisplayName = "Соколов Андрей Михайлович", Department = "Маркетинг", Title = "SMM-специалист", Email = "sokolov.a@navioffice.local", Role = "User" },
        new EmployeeInfo { Login = "vasileva.n", DisplayName = "Васильева Наталья Олеговна", Department = "ИТ", Title = "Инженер по тестированию", Email = "vasileva.n@navioffice.local", Role = "User" }
    };

    public Task<EmployeeInfo?> AuthenticateAsync(string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || password != DemoPassword)
        {
            return Task.FromResult<EmployeeInfo?>(null);
        }

        var employee = Find(username);
        return Task.FromResult(employee);
    }

    public Task<IReadOnlyList<EmployeeInfo>> SearchAsync(string query, int limit)
    {
        IEnumerable<EmployeeInfo> result = Employees;
        if (!string.IsNullOrWhiteSpace(query))
        {
            var q = query.Trim();
            result = Employees.Where(e =>
                e.Login.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                e.DisplayName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (e.Department?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false));
        }

        return Task.FromResult<IReadOnlyList<EmployeeInfo>>(result.Take(limit).ToList());
    }

    public Task<EmployeeInfo?> GetByLoginAsync(string login)
    {
        return Task.FromResult(Find(login));
    }

    public Task<(byte[] Data, string ContentType)?> GetPhotoAsync(string login)
    {
        var employee = Find(login);
        if (employee == null)
        {
            return Task.FromResult<(byte[], string)?>(null);
        }

        var avatar = AvatarGenerator.Generate(employee.Login, employee.DisplayName);
        return Task.FromResult<(byte[], string)?>(avatar);
    }

    private static EmployeeInfo? Find(string login)
    {
        return Employees.FirstOrDefault(e => string.Equals(e.Login, login?.Trim(), StringComparison.OrdinalIgnoreCase));
    }
}
