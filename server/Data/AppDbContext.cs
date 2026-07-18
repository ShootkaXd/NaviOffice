using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Models;

namespace NaviOffice.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Floor> Floors => Set<Floor>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Desk> Desks => Set<Desk>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<MeetingRoom> MeetingRooms => Set<MeetingRoom>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Marker> Markers => Set<Marker>();
    public DbSet<Office> Offices => Set<Office>();
    public DbSet<RoomAssignment> RoomAssignments => Set<RoomAssignment>();
    public DbSet<Presence> Presences => Set<Presence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Floor>(e =>
        {
            e.HasKey(f => f.Id);
            e.Property(f => f.Name).IsRequired();
        });

        modelBuilder.Entity<Room>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Name).IsRequired();
            e.HasOne(r => r.Floor)
                .WithMany(f => f.Rooms)
                .HasForeignKey(r => r.FloorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Desk>(e =>
        {
            e.HasKey(d => d.Id);
            e.Property(d => d.Name).IsRequired();
            e.HasOne(d => d.Floor)
                .WithMany(f => f.Desks)
                .HasForeignKey(d => d.FloorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Assignment>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.EmployeeLogin).IsRequired();
            e.HasIndex(a => a.EmployeeLogin).IsUnique();
            e.HasIndex(a => a.DeskId);
            e.HasOne(a => a.Desk)
                .WithMany(d => d.Assignments)
                .HasForeignKey(a => a.DeskId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Office>(e =>
        {
            e.HasKey(o => o.Id);
            e.Property(o => o.Name).IsRequired();
            e.HasMany(o => o.Floors)
                .WithOne()
                .HasForeignKey(f => f.OfficeId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RoomAssignment>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.EmployeeLogin).IsRequired();
            e.HasIndex(r => new { r.RoomId, r.EmployeeLogin }).IsUnique();
            e.HasOne(r => r.Room)
                .WithMany()
                .HasForeignKey(r => r.RoomId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Presence>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.EmployeeLogin).IsRequired();
            e.Property(p => p.Date).IsRequired();
            e.Property(p => p.Status).IsRequired();
            e.HasIndex(p => new { p.EmployeeLogin, p.Date }).IsUnique();
        });

        modelBuilder.Entity<MeetingRoom>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.Name).IsRequired();
            e.HasOne(m => m.Floor)
                .WithMany(f => f.MeetingRooms)
                .HasForeignKey(m => m.FloorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Booking>(e =>
        {
            e.HasKey(b => b.Id);
            e.HasIndex(b => new { b.MeetingRoomId, b.Start });
            e.HasOne(b => b.MeetingRoom)
                .WithMany(m => m.Bookings)
                .HasForeignKey(b => b.MeetingRoomId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Marker>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.Kind).IsRequired();
            e.HasOne(m => m.Floor)
                .WithMany()
                .HasForeignKey(m => m.FloorId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
