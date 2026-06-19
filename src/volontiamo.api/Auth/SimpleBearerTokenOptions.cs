namespace volontiamo.api.Auth;

public sealed class SimpleBearerTokenOptions
{
    public string SigningKey { get; set; } = string.Empty;
    public TimeSpan Lifetime { get; set; } = TimeSpan.FromHours(8);
}