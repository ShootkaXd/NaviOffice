using Microsoft.EntityFrameworkCore;

#pragma warning disable EF1002 // имена таблиц/колонок — константы из кода, пользовательский ввод сюда не попадает

namespace NaviOffice.Api.Data;

/// <summary>
/// Доводит существующую базу (созданную EnsureCreated в прежних версиях)
/// до актуальной схемы. На свежей базе EnsureCreated создаёт всё сам и эти запросы no-op.
/// Поддерживает SQLite и PostgreSQL.
/// </summary>
public static class SchemaUpgrade
{
    public static void Apply(AppDbContext db, bool postgres)
    {
        if (postgres)
        {
            ApplyPostgres(db);
        }
        else
        {
            ApplySqlite(db);
        }
    }

    // ---- PostgreSQL: есть IF NOT EXISTS для всего ----

    private static void ApplyPostgres(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Offices" (
                "Id" uuid NOT NULL CONSTRAINT "PK_Offices" PRIMARY KEY,
                "Name" text NOT NULL,
                "Order" integer NOT NULL
            );
            """);
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Floors" ADD COLUMN IF NOT EXISTS "OfficeId" uuid NULL;""");
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Desks" ADD COLUMN IF NOT EXISTS "Color" text NULL;""");
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Desks" ADD COLUMN IF NOT EXISTS "Width" double precision NULL;""");
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Desks" ADD COLUMN IF NOT EXISTS "Height" double precision NULL;""");
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Desks" ADD COLUMN IF NOT EXISTS "EquipmentJson" text NULL;""");
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "RoomAssignments" (
                "Id" uuid NOT NULL CONSTRAINT "PK_RoomAssignments" PRIMARY KEY,
                "RoomId" uuid NOT NULL,
                "EmployeeLogin" text NOT NULL,
                "AssignedBy" text NOT NULL,
                "AssignedAt" timestamp NOT NULL,
                CONSTRAINT "FK_RoomAssignments_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("""CREATE UNIQUE INDEX IF NOT EXISTS "IX_RoomAssignments_RoomId_EmployeeLogin" ON "RoomAssignments" ("RoomId", "EmployeeLogin");""");
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Presences" (
                "Id" uuid NOT NULL CONSTRAINT "PK_Presences" PRIMARY KEY,
                "EmployeeLogin" text NOT NULL,
                "Date" text NOT NULL,
                "Status" text NOT NULL
            );
            """);
        db.Database.ExecuteSqlRaw("""CREATE UNIQUE INDEX IF NOT EXISTS "IX_Presences_EmployeeLogin_Date" ON "Presences" ("EmployeeLogin", "Date");""");

        // Assignments: старая схема имела PK = DeskId (одно место — один сотрудник). Пересобираем с Id.
        var oldPk = db.Database
            .SqlQueryRaw<int>("""SELECT COUNT(*) AS "Value" FROM information_schema.columns WHERE table_name = 'Assignments' AND column_name = 'Id'""")
            .AsEnumerable().First() == 0;
        if (oldPk)
        {
            db.Database.ExecuteSqlRaw("""
                ALTER TABLE "Assignments" ADD COLUMN "Id" uuid NULL;
                UPDATE "Assignments" SET "Id" = gen_random_uuid();
                ALTER TABLE "Assignments" ALTER COLUMN "Id" SET NOT NULL;
                ALTER TABLE "Assignments" DROP CONSTRAINT "PK_Assignments";
                ALTER TABLE "Assignments" ADD CONSTRAINT "PK_Assignments" PRIMARY KEY ("Id");
                CREATE INDEX IF NOT EXISTS "IX_Assignments_DeskId" ON "Assignments" ("DeskId");
                """);
        }
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Markers" (
                "Id" uuid NOT NULL CONSTRAINT "PK_Markers" PRIMARY KEY,
                "FloorId" uuid NOT NULL,
                "X" double precision NOT NULL,
                "Y" double precision NOT NULL,
                "Kind" text NOT NULL,
                "Label" text NOT NULL,
                CONSTRAINT "FK_Markers_Floors_FloorId" FOREIGN KEY ("FloorId") REFERENCES "Floors" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("""CREATE INDEX IF NOT EXISTS "IX_Markers_FloorId" ON "Markers" ("FloorId");""");
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Rooms" ADD COLUMN IF NOT EXISTS "PointsJson" text NULL;""");
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Bookings" ADD COLUMN IF NOT EXISTS "AttendeesJson" text NULL;""");
    }

    // ---- SQLite: ADD COLUMN IF NOT EXISTS нет — проверяем pragma_table_info ----

    private static void ApplySqlite(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "MeetingRooms" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_MeetingRooms" PRIMARY KEY,
                "FloorId" TEXT NOT NULL,
                "X" REAL NOT NULL,
                "Y" REAL NOT NULL,
                "Width" REAL NOT NULL,
                "Height" REAL NOT NULL,
                "Name" TEXT NOT NULL,
                "Email" TEXT NULL,
                "Capacity" INTEGER NOT NULL,
                "Color" TEXT NOT NULL,
                CONSTRAINT "FK_MeetingRooms_Floors_FloorId" FOREIGN KEY ("FloorId") REFERENCES "Floors" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE INDEX IF NOT EXISTS "IX_MeetingRooms_FloorId" ON "MeetingRooms" ("FloorId");
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Bookings" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_Bookings" PRIMARY KEY,
                "MeetingRoomId" TEXT NOT NULL,
                "Start" TEXT NOT NULL,
                "End" TEXT NOT NULL,
                "Subject" TEXT NOT NULL,
                "OrganizerLogin" TEXT NOT NULL,
                "OrganizerName" TEXT NOT NULL,
                "AttendeesJson" TEXT NULL,
                CONSTRAINT "FK_Bookings_MeetingRooms_MeetingRoomId" FOREIGN KEY ("MeetingRoomId") REFERENCES "MeetingRooms" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE INDEX IF NOT EXISTS "IX_Bookings_MeetingRoomId_Start" ON "Bookings" ("MeetingRoomId", "Start");
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Markers" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_Markers" PRIMARY KEY,
                "FloorId" TEXT NOT NULL,
                "X" REAL NOT NULL,
                "Y" REAL NOT NULL,
                "Kind" TEXT NOT NULL,
                "Label" TEXT NOT NULL,
                CONSTRAINT "FK_Markers_Floors_FloorId" FOREIGN KEY ("FloorId") REFERENCES "Floors" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE INDEX IF NOT EXISTS "IX_Markers_FloorId" ON "Markers" ("FloorId");
            """);

        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Offices" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_Offices" PRIMARY KEY,
                "Name" TEXT NOT NULL,
                "Order" INTEGER NOT NULL
            );
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "RoomAssignments" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_RoomAssignments" PRIMARY KEY,
                "RoomId" TEXT NOT NULL,
                "EmployeeLogin" TEXT NOT NULL,
                "AssignedBy" TEXT NOT NULL,
                "AssignedAt" TEXT NOT NULL,
                CONSTRAINT "FK_RoomAssignments_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("""CREATE UNIQUE INDEX IF NOT EXISTS "IX_RoomAssignments_RoomId_EmployeeLogin" ON "RoomAssignments" ("RoomId", "EmployeeLogin");""");
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Presences" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_Presences" PRIMARY KEY,
                "EmployeeLogin" TEXT NOT NULL,
                "Date" TEXT NOT NULL,
                "Status" TEXT NOT NULL
            );
            """);
        db.Database.ExecuteSqlRaw("""CREATE UNIQUE INDEX IF NOT EXISTS "IX_Presences_EmployeeLogin_Date" ON "Presences" ("EmployeeLogin", "Date");""");

        AddColumnIfMissing(db, "Floors", "BackgroundImage", "BLOB NULL");
        AddColumnIfMissing(db, "Floors", "BackgroundContentType", "TEXT NULL");
        AddColumnIfMissing(db, "Floors", "OfficeId", "TEXT NULL");
        AddColumnIfMissing(db, "Rooms", "PointsJson", "TEXT NULL");
        AddColumnIfMissing(db, "Bookings", "AttendeesJson", "TEXT NULL");
        AddColumnIfMissing(db, "Desks", "Color", "TEXT NULL");
        AddColumnIfMissing(db, "Desks", "Width", "REAL NULL");
        AddColumnIfMissing(db, "Desks", "Height", "REAL NULL");
        AddColumnIfMissing(db, "Desks", "EquipmentJson", "TEXT NULL");

        // Assignments: старая схема имела PK = DeskId. SQLite не меняет PK — пересборка таблицы.
        var hasIdColumn = db.Database
            .SqlQueryRaw<int>("SELECT COUNT(*) AS \"Value\" FROM pragma_table_info('Assignments') WHERE \"name\" = 'Id'")
            .AsEnumerable().First() > 0;
        if (!hasIdColumn)
        {
            db.Database.ExecuteSqlRaw("""
                CREATE TABLE "Assignments_new" (
                    "Id" TEXT NOT NULL CONSTRAINT "PK_Assignments" PRIMARY KEY,
                    "DeskId" TEXT NOT NULL,
                    "EmployeeLogin" TEXT NOT NULL,
                    "AssignedBy" TEXT NOT NULL,
                    "AssignedAt" TEXT NOT NULL,
                    CONSTRAINT "FK_Assignments_Desks_DeskId" FOREIGN KEY ("DeskId") REFERENCES "Desks" ("Id") ON DELETE CASCADE
                );
                INSERT INTO "Assignments_new" ("Id", "DeskId", "EmployeeLogin", "AssignedBy", "AssignedAt")
                    SELECT upper(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-A' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
                           "DeskId", "EmployeeLogin", "AssignedBy", "AssignedAt"
                    FROM "Assignments";
                DROP TABLE "Assignments";
                ALTER TABLE "Assignments_new" RENAME TO "Assignments";
                CREATE UNIQUE INDEX "IX_Assignments_EmployeeLogin" ON "Assignments" ("EmployeeLogin");
                CREATE INDEX "IX_Assignments_DeskId" ON "Assignments" ("DeskId");
                """);
        }

        // Базы, мигрированные ранней версией, получили Id в нижнем регистре, а EF Core
        // в SQLite сравнивает GUID-текст с верхним регистром — DELETE/UPDATE не находили строки.
        db.Database.ExecuteSqlRaw("""UPDATE "Assignments" SET "Id" = upper("Id") WHERE "Id" <> upper("Id");""");
    }

    private static void AddColumnIfMissing(AppDbContext db, string table, string column, string definition)
    {
        var exists = db.Database
            .SqlQueryRaw<int>($"SELECT COUNT(*) AS \"Value\" FROM pragma_table_info('{table}') WHERE \"name\" = '{column}'")
            .AsEnumerable()
            .First() > 0;
        if (!exists)
        {
            db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {definition};");
        }
    }
}
