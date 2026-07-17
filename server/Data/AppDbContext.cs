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
            e.HasKey(a => a.DeskId);
            e.Property(a => a.EmployeeLogin).IsRequired();
            e.HasIndex(a => a.EmployeeLogin).IsUnique();
            e.HasOne(a => a.Desk)
                .WithOne(d => d.Assignment)
                .HasForeignKey<Assignment>(a => a.DeskId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
