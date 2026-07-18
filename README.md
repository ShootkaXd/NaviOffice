# NaviOffice

Интерактивная карта офиса: рассадка сотрудников, поиск по AD, бронирование переговорных через Outlook.

## Возможности

- **Редактор карты** (роль Admin): комнаты, столы, переговорные, несколько этажей, подложка-план этажа (PNG/JPEG/SVG)
- **Рассадка** (роли Admin и Secretary): назначение любого сотрудника на место, карточка с фото/ФИО/отделом/должностью из Active Directory
- **Поиск сотрудника**: карта переключает этаж и подсвечивает место
- **Переговорные**: статус занятости на карте (зелёный/красный), расписание на день, бронирование; в Graph-режиме брони создаются в Outlook-календарях
- **Вход по LDAP**, роли из групп AD

## Запуск (Demo-режим, без AD и Exchange)

```bash
# Терминал 1 — сервер (нужен .NET 8 SDK)
cd server && dotnet run          # http://localhost:5000

# Терминал 2 — клиент (нужен Node 18+)
cd client && npm install && npm run dev   # http://localhost:5173
```

Учётные записи: `admin` / `secretary` / `user`, пароль у всех — `demo`.

## База данных

По умолчанию — SQLite (файл `navioffice.db`, ничего настраивать не нужно). Для продакшена — PostgreSQL:

```json
"Database": { "Provider": "Postgres" },
"ConnectionStrings": {
  "Postgres": "Host=db.corp.local;Port=5432;Database=navioffice;Username=navioffice;Password=***"
}
```

Схема создаётся автоматически при первом запуске (`EnsureCreated`). Те же настройки можно передать переменными окружения: `Database__Provider=Postgres`, `ConnectionStrings__Postgres=...`.

## Подключение Active Directory (LDAP)

В `server/appsettings.json`:

```json
"Ldap": {
  "Mode": "Ldap",
  "Host": "dc.corp.local",
  "Port": 389,
  "BindDnFormat": "{0}@corp.local",
  "SearchBase": "DC=corp,DC=local",
  "AdminGroup": "CN=NaviOffice-Admins,OU=Groups,DC=corp,DC=local",
  "SecretaryGroup": "CN=NaviOffice-Secretaries,OU=Groups,DC=corp,DC=local"
}
```

ФИО, отдел, должность, email и фото берутся из атрибутов `displayName`, `department`, `title`, `mail`, `thumbnailPhoto`. Роль — по членству в группах (`memberOf`).

## Бронирование через Outlook (Microsoft 365 / Exchange Online)

1. Зарегистрируйте приложение в Entra ID (Azure AD), выдайте **application**-разрешение Microsoft Graph `Calendars.ReadWrite` и создайте client secret.
2. В `server/appsettings.json`:

```json
"Booking": { "Mode": "Graph" },
"Graph": {
  "TenantId": "<tenant-guid>",
  "ClientId": "<app-guid>",
  "ClientSecret": "<secret>",
  "TimeZone": "Russian Standard Time"
}
```

3. У каждой переговорной на карте укажите **Email переговорной** — адрес room mailbox из Exchange (свойства элемента в редакторе).

Бронь создаётся событием в календаре сотрудника с переговорной как ресурсом — room mailbox подтверждает её сам, встреча видна в Outlook. Занятость читается через `getSchedule`.

В Demo-режиме (`Booking:Mode = "Demo"`) брони хранятся в локальной SQLite.

## Интеграция с порталом

Клиент — самостоятельный SPA. Проще всего встроить в существующий ASP.NET-портал через `<iframe>` или ссылку; API (`/api/*`) можно вынести за общий reverse proxy.

## Структура

```
client/   Vite + React + TypeScript + Tailwind (SPA)
server/   ASP.NET Core 8 Web API + EF Core (SQLite) + LDAP + Graph
docs/     Контракт API
```
