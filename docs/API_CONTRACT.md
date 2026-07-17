# NaviOffice — API Contract v1

Клиент: React SPA (client/). Сервер: ASP.NET Core 8 Web API (server/), EF Core + SQLite, LDAP-аутентификация.

## Роли
- **Admin** — редактирует карту (комнаты/столы/этажи) + всё, что может Secretary.
- **Secretary** — назначает/снимает любого сотрудника на любое место.
- **User** — просмотр карты, поиск сотрудников.

Роль определяется членством в AD-группах (маппинг в appsettings: `Ldap:AdminGroup`, `Ldap:SecretaryGroup`), иначе User.

## Режимы LDAP (`Ldap:Mode` в appsettings.json)
- `Ldap` — реальное подключение (Novell.Directory.Ldap.NETStandard): bind по `{Ldap:BindDnFormat}` (напр. `{0}@corp.local` или `uid={0},ou=people,dc=corp,dc=local`), поиск сотрудников по `Ldap:SearchBase`, атрибуты: sAMAccountName/uid, displayName, department, title, mail, thumbnailPhoto, memberOf.
- `Demo` — встроенный список демо-сотрудников и логины admin/secretary/user (пароль = "demo"), фото — генерированные SVG-аватары с инициалами. Нужен для разработки и приёмки без AD.

## Auth
JWT Bearer. Токен содержит claims: `sub` (login), `name` (displayName), `role`.

| Метод | Путь | Роль | Тело/Ответ |
|---|---|---|---|
| POST | /api/auth/login | anon | `{username, password}` → `{token, user: {login, displayName, department, title, role}}` или 401 |
| GET | /api/auth/me | any | → `{login, displayName, department, title, role}` |

## Employees (из AD, кэш в памяти 10 мин)
| Метод | Путь | Роль | Описание |
|---|---|---|---|
| GET | /api/employees?search=строка | any | Поиск по ФИО/логину/отделу, до 20 результатов: `[{login, displayName, department, title, email, deskId?}]` (deskId — если назначен) |
| GET | /api/employees/{login}/photo | any | image/svg+xml или image/jpeg (thumbnailPhoto из AD), 404 если нет |

## Map
| Метод | Путь | Роль | Описание |
|---|---|---|---|
| GET | /api/map | any | Вся карта: `{floors: [{id, name, order}], rooms: [...], desks: [...]}` — desk включает `assignment: {login, displayName, department, title} \| null` |
| POST | /api/floors | Admin | `{name}` → floor |
| PUT | /api/floors/{id} | Admin | `{name, order}` |
| DELETE | /api/floors/{id} | Admin | каскадно удаляет элементы |
| PUT | /api/floors/{id}/elements | Admin | Bulk-сохранение: `{rooms: [{id?, x, y, width, height, name, color, capacity}], desks: [{id?, x, y, name, rotation}]}` — заменяет элементы этажа; существующие id сохраняются (и их assignments), отсутствующие удаляются |
| PUT | /api/desks/{id}/assignment | Admin, Secretary | `{login}` → 200 c обновлённым desk; одно место = один сотрудник; сотрудник может быть только на одном месте (переназначение снимает со старого) |
| DELETE | /api/desks/{id}/assignment | Admin, Secretary | Снять сотрудника |

## Модели БД (SQLite, EF Core, автосоздание при старте)
- Floor: Id (guid), Name, Order
- Room: Id, FloorId (FK), X, Y, Width, Height, Name, Color, Capacity
- Desk: Id, FloorId (FK), X, Y, Name, Rotation
- Assignment: DeskId (PK, FK), EmployeeLogin, AssignedBy, AssignedAt

## Прочее
- CORS: разрешить http://localhost:5173 (dev).
- Сервер слушает :5000. Клиент проксирует `/api` на :5000 (vite proxy).
- Seed при первом запуске: 1 этаж "Этаж 1" с примером (2 комнаты, 6 столов).
