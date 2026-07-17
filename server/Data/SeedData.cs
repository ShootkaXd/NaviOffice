using NaviOffice.Api.Models;

namespace NaviOffice.Api.Data;

public static class SeedData
{
    public static void EnsureSeeded(AppDbContext db)
    {
        if (db.Floors.Any())
        {
            return;
        }

        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = "Этаж 1",
            Order = 1
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

        var meetingRoom = new Room
        {
            Id = Guid.NewGuid(),
            FloorId = floor.Id,
            X = 600,
            Y = 40,
            Width = 260,
            Height = 200,
            Name = "Переговорная",
            Color = "#DCFCE7",
            Capacity = 6
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
        db.Rooms.AddRange(openSpace, meetingRoom);
        db.Desks.AddRange(desks);
        db.SaveChanges();
    }
}
