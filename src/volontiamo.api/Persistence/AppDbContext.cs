using Microsoft.EntityFrameworkCore;
using volontiamo.domain;

namespace volontiamo.api.Persistence;

public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();

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
            entity.Property(u => u.IsDeleted).HasColumnName("is_deleted").IsRequired();
            entity.Property(u => u.CreatedAt).HasColumnName("created_at").IsRequired();
            entity.Property(u => u.UpdatedAt).HasColumnName("updated_at").IsRequired();

            entity.HasIndex(u => u.Email).IsUnique().HasDatabaseName("ix_users_email");
            entity.HasQueryFilter(u => !u.IsDeleted);
        });
    }
}
