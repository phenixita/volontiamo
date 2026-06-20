using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using volontiamo.domain;

namespace volontiamo.api.Reports;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reports")
            .WithTags("Reports")
            .RequireAuthorization();

        group.MapGet("/summary", GetSummary);
        group.MapGet("/leaderboard", GetLeaderboard);
        group.MapGet("/me", GetMyReport);
    }

    private static async Task<IResult> GetSummary(
        HttpContext context,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromServices] AuthenticationService authService,
        [FromServices] ReportingService reportingService,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Lilt)
        {
            return Results.Problem(
                detail: "Only staff can access reporting summary.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await reportingService.GetSummaryAsync(new ReportingSummaryRequest(from, to), ct);
        return MapReportResult(result);
    }

    private static async Task<IResult> GetLeaderboard(
        HttpContext context,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromServices] AuthenticationService authService,
        [FromServices] ReportingService reportingService,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Lilt)
        {
            return Results.Problem(
                detail: "Only staff can access reporting leaderboard.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await reportingService.GetLeaderboardAsync(new ReportingLeaderboardRequest(from, to, page ?? 1, pageSize ?? 10), ct);
        return MapReportResult(result);
    }

    private static async Task<IResult> GetMyReport(
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] ReportingService reportingService,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can access personal reporting.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await reportingService.GetVolunteerOverviewAsync(currentUser.User.Id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "Volunteer report not found.",
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found"),
            _ => Results.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static IResult MapReportResult<T>(Result<T> result)
    {
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.ValidationError => Results.ValidationProblem(
                result.Errors.GroupBy(error => error.Field)
                    .ToDictionary(group => group.Key, group => group.Select(error => error.Message).ToArray())),
            _ => Results.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static async Task<CurrentUserResolution> GetCurrentUserAsync(
        HttpContext context,
        AuthenticationService authService,
        CancellationToken ct)
    {
        var rawUserId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(rawUserId, out var userId))
            return new CurrentUserResolution(null, Results.Unauthorized());

        var result = await authService.GetCurrentUserAsync(userId, ct);
        return result.Status switch
        {
            ResultStatus.Ok => new CurrentUserResolution(result.Value, null),
            ResultStatus.NotFound => new CurrentUserResolution(null, Results.Problem(
                detail: "User not found.",
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found")),
            ResultStatus.Unauthorized => new CurrentUserResolution(null, Results.Problem(
                detail: result.ErrorMessage,
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Unauthorized")),
            _ => new CurrentUserResolution(null, Results.StatusCode(StatusCodes.Status500InternalServerError))
        };
    }

    private sealed record CurrentUserResolution(AuthenticatedUserResponse? User, IResult? Error);
}