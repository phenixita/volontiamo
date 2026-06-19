namespace volontiamo.domain;

public record CreateUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string InitialPassword,
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
    string? NewPassword,
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

public sealed class UserService
{
    private readonly IUserRepository _repository;
    private readonly IUserPasswordHasher _passwordHasher;

    public UserService(IUserRepository repository, IUserPasswordHasher passwordHasher)
    {
        _repository = repository;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<UserResponse>> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        var validationErrors = ValidateCreate(request);
        if (validationErrors.Count > 0)
            return Result<UserResponse>.ValidationFailure(validationErrors);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _repository.ExistsByEmailAsync(normalizedEmail, ct: ct))
            return Result<UserResponse>.Conflict("A user with this email already exists.");

        var passwordHash = _passwordHasher.Hash(request.InitialPassword);

        var user = User.Create(
            request.FirstName,
            request.LastName,
            request.Email,
            request.Phone,
            request.DateOfBirth,
            request.EnrollmentDate,
            request.EndDate,
            request.IsActive,
            request.UserType,
            request.Occupation,
            passwordHash);

        await _repository.AddAsync(user, ct);
        await _repository.SaveChangesAsync(ct);

        return Result<UserResponse>.Success(MapToResponse(user));
    }

    public async Task<Result<UserResponse>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _repository.GetByIdAsync(id, ct);
        if (user is null)
            return Result<UserResponse>.NotFound();

        return Result<UserResponse>.Success(MapToResponse(user));
    }

    public async Task<PagedResponse<UserResponse>> ListAsync(int page, int pageSize, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var result = await _repository.ListAsync(page, pageSize, ct);
        var items = result.Items.Select(MapToResponse).ToList();
        return new PagedResponse<UserResponse>(items, page, pageSize, result.TotalCount);
    }

    public async Task<Result<UserResponse>> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var validationErrors = ValidateUpdate(request);
        if (validationErrors.Count > 0)
            return Result<UserResponse>.ValidationFailure(validationErrors);

        var user = await _repository.GetByIdAsync(id, ct);
        if (user is null)
            return Result<UserResponse>.NotFound();

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _repository.ExistsByEmailAsync(normalizedEmail, excludeId: id, ct: ct))
            return Result<UserResponse>.Conflict("A user with this email already exists.");

        user.Update(
            request.FirstName,
            request.LastName,
            request.Email,
            request.Phone,
            request.DateOfBirth,
            request.EnrollmentDate,
            request.EndDate,
            request.IsActive,
            request.UserType,
            request.Occupation);

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
            user.SetPasswordHash(_passwordHasher.Hash(request.NewPassword));

        await _repository.SaveChangesAsync(ct);

        return Result<UserResponse>.Success(MapToResponse(user));
    }

    public async Task<Result<bool>> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _repository.GetByIdAsync(id, ct);
        if (user is null)
            return Result<bool>.NotFound();

        user.SoftDelete();
        await _repository.SaveChangesAsync(ct);

        return Result<bool>.Success(true);
    }

    private static List<ValidationError> ValidateCreate(CreateUserRequest r)
    {
        var errors = new List<ValidationError>();
        if (string.IsNullOrWhiteSpace(r.FirstName))
            errors.Add(new("firstName", "First name is required."));
        if (string.IsNullOrWhiteSpace(r.LastName))
            errors.Add(new("lastName", "Last name is required."));
        if (string.IsNullOrWhiteSpace(r.Email))
            errors.Add(new("email", "Email is required."));
        if (string.IsNullOrWhiteSpace(r.InitialPassword))
            errors.Add(new("initialPassword", "Initial password is required."));
        if (r.EndDate.HasValue && r.EndDate < r.EnrollmentDate)
            errors.Add(new("endDate", "End date cannot be earlier than enrollment date."));
        return errors;
    }

    private static List<ValidationError> ValidateUpdate(UpdateUserRequest r)
    {
        var errors = new List<ValidationError>();
        if (string.IsNullOrWhiteSpace(r.FirstName))
            errors.Add(new("firstName", "First name is required."));
        if (string.IsNullOrWhiteSpace(r.LastName))
            errors.Add(new("lastName", "Last name is required."));
        if (string.IsNullOrWhiteSpace(r.Email))
            errors.Add(new("email", "Email is required."));
        if (r.NewPassword is not null && string.IsNullOrWhiteSpace(r.NewPassword))
            errors.Add(new("newPassword", "New password cannot be empty."));
        if (r.EndDate.HasValue && r.EndDate < r.EnrollmentDate)
            errors.Add(new("endDate", "End date cannot be earlier than enrollment date."));
        return errors;
    }

    private static UserResponse MapToResponse(User user)
    {
        return new UserResponse(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email,
            user.Phone,
            user.DateOfBirth,
            user.EnrollmentDate,
            user.EndDate,
            user.IsActive,
            user.UserType,
            user.Occupation,
            user.CreatedAt,
            user.UpdatedAt);
    }
}
