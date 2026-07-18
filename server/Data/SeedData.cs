using NaviOffice.Api.Models;

namespace NaviOffice.Api.Data;

public static class SeedData
{
    public static void EnsureSeeded(AppDbContext db)
    {
        // Офис по умолчанию + привязка «безофисных» этажей (миграция со старых версий).
        var defaultOffice = db.Offices.OrderBy(o => o.Order).FirstOrDefault();
        if (defaultOffice == null)
        {
            defaultOffice = new Office { Id = Guid.NewGuid(), Name = "Головной офис", Order = 1 };
            db.Offices.Add(defaultOffice);
            db.SaveChanges();
        }
        foreach (var orphan in db.Floors.Where(f => f.OfficeId == null).ToList())
        {
            orphan.OfficeId = defaultOffice.Id;
        }
        db.SaveChanges();

        if (db.Floors.Any())
        {
            return;
        }

        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = "Этаж 1",
            Order = 1,
            OfficeId = defaultOffice.Id
        };

        var openSpace = new Room
        {
            Id = Guid.NewGuid(),
            FloorId = floor.Id,
            X = 40,
            Y = 40,
            Width = 520,
            Height = 340,
            Name = "Опенспейс",
            Color = "#DBEAFE",
            Capacity = 8
        };

        var kitchen = new Room
        {
            Id = Guid.NewGuid(),
            FloorId = floor.Id,
            X = 600,
            Y = 260,
            Width = 260,
            Height = 120,
            Name = "Кухня",
            Color = "#DCFCE7",
            Capacity = 6
        };

        var meetingRoom = new MeetingRoom
        {
            Id = Guid.NewGuid(),
            FloorId = floor.Id,
            X = 600,
            Y = 40,
            Width = 260,
            Height = 200,
            Name = "Переговорная А",
            Capacity = 8,
            Color = "#8b5cf6"
        };

        var desks = new List<Desk>();
        for (var i = 0; i < 6; i++)
        {
            var col = i % 3;
            var row = i / 3;
            desks.Add(new Desk
            {
                Id = Guid.NewGuid(),
                FloorId = floor.Id,
                X = 90 + col * 160,
                Y = 100 + row * 150,
                Name = $"Стол {i + 1}",
                Rotation = 0
            });
        }

        db.Floors.Add(floor);
        db.Rooms.AddRange(openSpace, kitchen);
        db.MeetingRooms.Add(meetingRoom);
        db.Desks.AddRange(desks);
        db.SaveChanges();
    }
}
