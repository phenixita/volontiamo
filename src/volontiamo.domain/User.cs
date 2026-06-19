namespace volontiamo.domain;

public enum UserType
{
    Lilt = 0,
    Volontario = 1
}

public class User
{
    public Guid Id { get; private set; }
    public string FirstName { get; private set; } = default!;
    public string LastName { get; private set; } = default!;
    public string Email { get; private set; } = default!;
    public string? Phone { get; private set; }
    public DateOnly? DateOfBirth { get; private set; }
    public DateOnly EnrollmentDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public bool IsActive { get; private set; }
    public UserType UserType { get; private set; }
    public string? Occupation { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private User() { }

    public static User Create(
        string firstName,
        string lastName,
        string email,
        string? phone,
        DateOnly? dateOfBirth,
        DateOnly enrollmentDate,
        DateOnly? endDate,
        bool isActive,
        UserType userType,
        string? occupation)
    {
        var now = DateTime.UtcNow;
        return new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName,
            LastName = lastName,
            Email = email.Trim().ToLowerInvariant(),
            Phone = phone,
            DateOfBirth = dateOfBirth,
            EnrollmentDate = enrollmentDate,
            EndDate = endDate,
            IsActive = isActive,
            UserType = userType,
            Occupation = occupation,
            IsDeleted = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Update(
        string firstName,
        string lastName,
        string email,
        string? phone,
        DateOnly? dateOfBirth,
        DateOnly enrollmentDate,
        DateOnly? endDate,
        bool isActive,
        UserType userType,
        string? occupation)
    {
        FirstName = firstName;
        LastName = lastName;
        Email = email.Trim().ToLowerInvariant();
        Phone = phone;
        DateOfBirth = dateOfBirth;
        EnrollmentDate = enrollmentDate;
        EndDate = endDate;
        IsActive = isActive;
        UserType = userType;
        Occupation = occupation;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SoftDelete()
    {
        IsDeleted = true;
        UpdatedAt = DateTime.UtcNow;
    }
}
