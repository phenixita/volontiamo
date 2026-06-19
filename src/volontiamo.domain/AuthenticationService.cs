namespace volontiamo.domain;

public record AuthenticateUserRequest(string Email, string Password);

public record AuthenticatedUserResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    bool IsActive,
    UserType UserType);

public interface IUserPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string passwordHash);
}

public sealed class AuthenticationService
{
    private readonly IUserRepository _repository;
    private readonly IUserPasswordHasher _passwordHasher;

    public AuthenticationService(IUserRepository repository, IUserPasswordHasher passwordHasher)
    {
        _repository = repository;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<AuthenticatedUserResponse>> AuthenticateAsync(AuthenticateUserRequest request, CancellationToken ct = default)
    {
        var validationErrors = ValidateAuthenticate(request);
        if (validationErrors.Count > 0)
            return Result<AuthenticatedUserResponse>.ValidationFailure(validationErrors);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _repository.GetByEmailAsync(normalizedEmail, ct);
        if (user is null)
            return Result<AuthenticatedUserResponse>.Unauthorized("Invalid email or password.");

        if (!user.IsActive)
            return Result<AuthenticatedUserResponse>.Unauthorized("User is inactive.");

        var passwordMatches = _passwordHasher.Verify(request.Password, user.PasswordHash);
        if (!passwordMatches)
            return Result<AuthenticatedUserResponse>.Unauthorized("Invalid email or password.");

        return Result<AuthenticatedUserResponse>.Success(MapToResponse(user));
    }

    public async Task<Result<AuthenticatedUserResponse>> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _repository.GetByIdAsync(userId, ct);
        if (user is null)
            return Result<AuthenticatedUserResponse>.NotFound();

        if (!user.IsActive)
            return Result<AuthenticatedUserResponse>.Unauthorized("User is inactive.");

        return Result<AuthenticatedUserResponse>.Success(MapToResponse(user));
    }

    private static List<ValidationError> ValidateAuthenticate(AuthenticateUserRequest request)
    {
        var errors = new List<ValidationError>();
        if (string.IsNullOrWhiteSpace(request.Email))
            errors.Add(new("email", "Email is required."));
        if (string.IsNullOrWhiteSpace(request.Password))
            errors.Add(new("password", "Password is required."));
        return errors;
    }

    private static AuthenticatedUserResponse MapToResponse(User user)
    {
        return new AuthenticatedUserResponse(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email,
            user.IsActive,
            user.UserType);
    }
}