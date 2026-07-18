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

---

# v2 — Переговорные, бронирование через Outlook, планы этажей

## MeetingRoom (новый элемент карты)
Модель: Id (guid), FloorId (FK, cascade), X, Y, Width, Height, Name, Email (nullable — почта room mailbox в Exchange), Capacity, Color (default #8b5cf6).

- GET /api/map → добавляется `meetingRooms: [{id, floorId, x, y, width, height, name, email, capacity, color}]` (без live-статуса — он отдельным эндпоинтом).
- PUT /api/floors/{id}/elements → тело дополняется `meetingRooms: [{id?, x, y, width, height, name, email, capacity, color}]`; та же семантика bulk replace: существующие id сохраняются (и их брони в Demo-режиме), отсутствующие удаляются.

## Бронирование (`Booking:Mode` = `Demo` | `Graph`)
| Метод | Путь | Роль | Описание |
|---|---|---|---|
| GET | /api/meetingrooms/status | any | `[{id, busy, until}]` — busy=true если сейчас идёт встреча, until = ISO-время конца текущей встречи (busy) или начала следующей (free, null если сегодня встреч больше нет). Кэш 60 сек. |
| GET | /api/meetingrooms/{id}/schedule?date=YYYY-MM-DD | any | `{items: [{start, end, subject, organizer}]}` — брони за день, ISO 8601 |
| POST | /api/meetingrooms/{id}/bookings | any | `{start, end, subject}` → 201; 409 если время пересекается с существующей бронью; 400 если start>=end или в прошлом |

**Demo-режим**: таблица SQLite `Bookings {Id, MeetingRoomId (FK cascade), Start, End, Subject, OrganizerLogin, OrganizerName}`. Проверка пересечения интервалов. Organizer из JWT.

**Graph-режим** (Outlook / Microsoft 365 / Exchange):
- Конфиг `Graph:TenantId, ClientId, ClientSecret` — app-only client credentials, токен по `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` (scope `https://graph.microsoft.com/.default`), кэш до истечения. Реализация на HttpClient (IHttpClientFactory), без тяжёлых SDK.
- Занятость: POST `/v1.0/users/{roomEmail}/calendar/getSchedule` (schedules=[roomEmail], start/end дня).
- Бронь: POST `/v1.0/users/{userEmail}/events` — событие в календаре сотрудника с переговорной как attendee `type: "resource"` (room mailbox сам подтверждает и попадает в Outlook). userEmail — из claim email JWT (LDAP mail).
- Ошибки Graph логировать; клиенту 502 с текстом.

## JWT
Добавить claim `email` (LDAP mail; в Demo — `{login}@demo.local`).

## План этажа (подложка)
Floor дополняется: `BackgroundImage (byte[], nullable)`, `BackgroundContentType (string, nullable)`.
| Метод | Путь | Роль | Описание |
|---|---|---|---|
| GET | /api/floors/{id}/background | any (auth) | image/png|jpeg|svg+xml или 404 |
| PUT | /api/floors/{id}/background | Admin | multipart/form-data, поле `file`; типы png/jpg/jpeg/svg, максимум 10 МБ; 415 при другом типе |
| DELETE | /api/floors/{id}/background | Admin | убрать подложку |

GET /api/map: floors получают `hasBackground: bool`.

## Клиент v2
- Инструмент «Переговорная» в тулбаре (Admin): рисуется как комната, стиль отличen — фиолетовый по умолчанию, иконка календаря, имя + вместимость.
- Статусы переговорных на карте: точка/заливка — зелёная (свободна), красная (идёт встреча); поллинг /api/meetingrooms/status каждые 60 сек + рефреш после брони.
- Клик по переговорной (любая роль) → карточка: название, вместимость, статус («Свободна до 15:00» / «Занята до 14:30»), таймлайн броней на сегодня, кнопка «Забронировать».
- Диалог брони: дата (default сегодня), время с/до (шаг 15 мин), тема; 409 → «Это время уже занято».
- PropertiesPanel переговорной (Admin): название, email переговорной (подсказка: почта room mailbox из Exchange), вместимость, цвет.
- Подложка: для Admin кнопка «План этажа…» (upload) + «Убрать план»; рендер в SVG `<image>` под сеткой (загрузка через authenticated fetch → blob URL, как фото сотрудников).

---

# v3 — Участники броней, полигональные комнаты, метки принтеров

## Участники брони
- `POST /api/meetingrooms/{id}/bookings` — тело дополняется `attendees: string[]` (логины сотрудников, опционально).
- Demo: имена участников хранятся в Bookings.AttendeesJson; schedule items включают `attendees: string[]` (имена).
- Graph: участники добавляются в событие как required attendees (email из справочника AD); в getSchedule участники недоступны → пустой массив.

## Полигональные (угловые) комнаты
- Room дополняется `PointsJson (string, nullable)` — JSON-массив вершин `[{x,y},...]`. null — обычный прямоугольник.
- x/y/width/height остаются как bbox (для подписи и обратной совместимости).
- DTO: `points: [{x,y}] | null` в RoomDto и RoomElementDto.
- Клиент: у выбранной комнаты — квадратные хэндлы вершин (drag), круглые хэндлы на серединах рёбер (mousedown = вставить вершину и тянуть). Прямоугольник превращается в полигон при первом добавлении вершины. Двойной клик по вершине удаляет её (минимум 3).

## Метки (принтеры)
- Новая таблица Markers: Id, FloorId (FK cascade), X, Y, Kind (string, пока "printer"), Label.
- GET /api/map → `markers: [...]`; PUT elements → `markers: [{id?, x, y, kind, label}]` (bulk replace).
- Клиент: инструмент «Принтер» (Admin), клик — поставить, drag — перемещение, свойства — подпись.

## Цвета
- В свойствах комнат/переговорных, помимо палитры, произвольный выбор цвета (`<input type=color>`).

## Схема
- SchemaUpgrade становится provider-aware: для SQLite и Postgres добавляет недостающие таблицы/колонки (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

## Багфикс
- Столы/переговорные/комнаты можно рисовать и ставить поверх уже нарисованных комнат (в режимах рисования события мыши элементов пробрасываются к канвасу).
