using Microsoft.AspNetCore.Identity;
using volontiamo.domain;

namespace volontiamo.api.Auth;

public sealed class ApiPasswordHasher : IUserPasswordHasher
{
    private static readonly object UserMarker = new();
    private readonly PasswordHasher<object> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(UserMarker, password);

    public bool Verify(string password, string passwordHash)
    {
        var result = _hasher.VerifyHashedPassword(UserMarker, passwordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}