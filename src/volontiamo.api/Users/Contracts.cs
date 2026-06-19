using volontiamo.domain;

namespace volontiamo.api.Users;

public record CreateUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    DateOnly? DateOfBirth,
    DateOnly EnrollmentDate,
    DateOnly? EndDate,
    bool IsActive,
    UserType UserType,
    string? Occupation);

public record UpdateUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    DateOnly? DateOfBirth,
    DateOnly EnrollmentDate,
    DateOnly? EndDate,
    bool IsActive,
    UserType UserType,
    string? Occupation);

public record UserResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    DateOnly? DateOfBirth,
    DateOnly EnrollmentDate,
    DateOnly? EndDate,
    bool IsActive,
    UserType UserType,
    string? Occupation,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);
