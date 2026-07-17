using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace NaviOffice.Api.Data;

/// <summary>
/// Доводит существующую v1-базу (созданную EnsureCreated до появления переговорных)
/// до актуальной схемы. На свежей базе EnsureCreated создаёт всё сам и эти запросы no-op.
/// </summary>
public static class SchemaUpgrade
{
    public static void Apply(AppDbContext db)
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
                CONSTRAINT "FK_Bookings_MeetingRooms_MeetingRoomId" FOREIGN KEY ("MeetingRoomId") REFERENCES "MeetingRooms" ("Id") ON DELETE CASCADE
            );
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE INDEX IF NOT EXISTS "IX_Bookings_MeetingRoomId_Start" ON "Bookings" ("MeetingRoomId", "Start");
            """);

        AddColumnIfMissing(db, "Floors", "BackgroundImage", "BLOB NULL");
        AddColumnIfMissing(db, "Floors", "BackgroundContentType", "TEXT NULL");
    }

    private static void AddColumnIfMissing(AppDbContext db, string table, string column, string definition)
    {
        try
        {
            db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {definition};");
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("duplicate column", StringComparison.OrdinalIgnoreCase))
        {
            // колонка уже есть — база актуальна
        }
    }
}
