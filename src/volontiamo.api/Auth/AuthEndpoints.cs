using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using volontiamo.domain;

namespace volontiamo.api.Auth;

public record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, AuthenticatedUserResponse User);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth")
            .WithTags("Auth");

        group.MapPost("/login", Login).AllowAnonymous();
        group.MapGet("/me", Me).RequireAuthorization();
    }

    private static async Task<IResult> Login(
        [FromBody] AuthenticateUserRequest request,
        [FromServices] AuthenticationService authService,
        [FromServices] IBearerTokenService tokenService,
        CancellationToken ct)
    {
        var result = await authService.AuthenticateAsync(request, ct);
        return result.Status switch
        {
            ResultStatus.Ok => CreateLoginResponse(result.Value!, tokenService),
            ResultStatus.Unauthorized => Results.Problem(
                detail: result.ErrorMessage,
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Unauthorized"),
            ResultStatus.ValidationError => Results.ValidationProblem(
                result.Errors.GroupBy(e => e.Field)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray())),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> Me(
        ClaimsPrincipal principal,
        [FromServices] AuthenticationService authService,
        CancellationToken ct)
    {
        var rawUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(rawUserId, out var userId))
            return Results.Unauthorized();

        var result = await authService.GetCurrentUserAsync(userId, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "User not found.",
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found"),
            ResultStatus.Unauthorized => Results.Problem(
                detail: result.ErrorMessage,
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Unauthorized"),
            _ => Results.StatusCode(500)
        };
    }

    private static IResult CreateLoginResponse(AuthenticatedUserResponse user, IBearerTokenService tokenService)
    {
        var token = tokenService.CreateToken(user);
        return Results.Ok(new LoginResponse(token.Value, token.ExpiresAt, user));
    }
}