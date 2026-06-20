using Microsoft.EntityFrameworkCore;
using volontiamo.domain;

namespace volontiamo.api.Persistence;

public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventParticipation> EventParticipations => Set<EventParticipation>();
    public DbSet<Notification> Notifications => Set<Notification>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(u => u.Id);

            entity.Property(u => u.Id).HasColumnName("id");
            entity.Property(u => u.FirstName).HasColumnName("first_name").HasMaxLength(200).IsRequired();
            entity.Property(u => u.LastName).HasColumnName("last_name").HasMaxLength(200).IsRequired();
            entity.Property(u => u.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            entity.Property(u => u.Phone).HasColumnName("phone").HasMaxLength(50);
            entity.Property(u => u.DateOfBirth).HasColumnName("date_of_birth");
            entity.Property(u => u.EnrollmentDate).HasColumnName("enrollment_date").IsRequired();
            entity.Property(u => u.EndDate).HasColumnName("end_date");
            entity.Property(u => u.IsActive).HasColumnName("is_active").IsRequired();
            entity.Property(u => u.UserType).HasColumnName("user_type").IsRequired();
            entity.Property(u => u.Occupation).HasColumnName("occupation").HasMaxLength(200);
            entity.Property(u => u.PasswordHash).HasColumnName("password_hash").HasColumnType("text").IsRequired();
            entity.Property(u => u.IsDeleted).HasColumnName("is_deleted").IsRequired();
            entity.Property(u => u.CreatedAt).HasColumnName("created_at").IsRequired();
            entity.Property(u => u.UpdatedAt).HasColumnName("updated_at").IsRequired();

            entity.HasIndex(u => u.Email).IsUnique().HasDatabaseName("ix_users_email");
            entity.HasQueryFilter(u => !u.IsDeleted);
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.ToTable("events");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasColumnName("id")
                .UseIdentityByDefaultColumn();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(e => e.StartAtUtc).HasColumnName("start_at_utc").HasColumnType("timestamp with time zone").IsRequired();
            entity.Property(e => e.EndAtUtc).HasColumnName("end_at_utc").HasColumnType("timestamp with time zone").IsRequired();
            entity.Property(e => e.Location).HasColumnName("location").HasMaxLength(300);
            entity.Property(e => e.OperationalNotesMarkdown).HasColumnName("operational_notes_markdown").HasColumnType("text").IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").IsRequired();
            entity.Property(e => e.IsDeleted).HasColumnName("is_deleted").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp with time zone").IsRequired();
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamp with time zone").IsRequired();

            entity.HasIndex(e => e.Name).HasDatabaseName("ix_events_name");
            entity.HasIndex(e => e.Status).HasDatabaseName("ix_events_status");
            entity.HasIndex(e => e.StartAtUtc).HasDatabaseName("ix_events_start_at_utc");
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<EventParticipation>(entity =>
        {
            entity.ToTable("event_participations");
            entity.HasKey(p => new { p.EventId, p.UserId });

            entity.Property(p => p.EventId).HasColumnName("event_id").IsRequired();
            entity.Property(p => p.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(p => p.Status).HasColumnName("participation_status").IsRequired();
            entity.Property(p => p.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp with time zone").IsRequired();
            entity.Property(p => p.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamp with time zone").IsRequired();

            entity.HasOne<Event>()
                .WithMany()
                .HasForeignKey(p => p.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(p => p.UserId).HasDatabaseName("ix_event_participations_user_id");
            entity.HasIndex(p => p.EventId).HasDatabaseName("ix_event_participations_event_id");
            entity.HasIndex(p => new { p.UserId, p.Status }).HasDatabaseName("ix_event_participations_user_id_status");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(notification => notification.Id);

            entity.Property(notification => notification.Id).HasColumnName("id");
            entity.Property(notification => notification.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(notification => notification.Kind).HasColumnName("kind").IsRequired();
            entity.Property(notification => notification.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
            entity.Property(notification => notification.Body).HasColumnName("body").HasColumnType("text").IsRequired();
            entity.Property(notification => notification.EventId).HasColumnName("event_id").IsRequired();
            entity.Property(notification => notification.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp with time zone").IsRequired();
            entity.Property(notification => notification.ReadAt).HasColumnName("read_at").HasColumnType("timestamp with time zone");

            entity.HasOne(notification => notification.Event)
                .WithMany()
                .HasForeignKey(notification => notification.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(notification => notification.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(notification => notification.UserId).HasDatabaseName("ix_notifications_user_id");
            entity.HasIndex(notification => notification.ReadAt).HasDatabaseName("ix_notifications_read_at");
            entity.HasIndex(notification => notification.CreatedAt).HasDatabaseName("ix_notifications_created_at");
        });
    }
}
