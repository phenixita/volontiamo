using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using volontiamo.domain;

namespace volontiamo.api.Auth;

public sealed record BearerToken(string Value, DateTimeOffset ExpiresAt);

public interface IBearerTokenService
{
    BearerToken CreateToken(AuthenticatedUserResponse user);
    bool TryValidateToken(string token, out Guid userId);
}

public sealed class BearerTokenService : IBearerTokenService
{
    private const string Version = "v1";
    private readonly SimpleBearerTokenOptions _options;
    private readonly TimeProvider _timeProvider;

    public BearerTokenService(IOptions<SimpleBearerTokenOptions> options, TimeProvider timeProvider)
    {
        _options = options.Value;
        _timeProvider = timeProvider;
    }

    public BearerToken CreateToken(AuthenticatedUserResponse user)
    {
        var expiresAt = _timeProvider.GetUtcNow().Add(_options.Lifetime);
        var payload = $"{Version}.{user.Id:D}.{expiresAt.ToUnixTimeSeconds()}";
        var signature = Sign(payload);
        return new BearerToken($"{payload}.{signature}", expiresAt);
    }

    public bool TryValidateToken(string token, out Guid userId)
    {
        userId = Guid.Empty;

        var parts = token.Split('.', StringSplitOptions.TrimEntries);
        if (parts.Length != 4 || parts[0] != Version)
            return false;

        var payload = string.Join('.', parts.Take(3));
        var expectedSignature = Sign(payload);
        if (!FixedTimeEquals(parts[3], expectedSignature))
            return false;

        if (!Guid.TryParse(parts[1], out var parsedUserId))
            return false;

        if (!long.TryParse(parts[2], out var expiresUnix))
            return false;

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(expiresUnix);
        if (expiresAt <= _timeProvider.GetUtcNow())
            return false;

        userId = parsedUserId;
        return true;
    }

    private string Sign(string payload)
    {
        var key = Encoding.UTF8.GetBytes(_options.SigningKey);
        var bytes = Encoding.UTF8.GetBytes(payload);
        return WebEncoders.Base64UrlEncode(HMACSHA256.HashData(key, bytes));
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}