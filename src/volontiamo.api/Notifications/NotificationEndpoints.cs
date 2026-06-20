using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using volontiamo.domain;

namespace volontiamo.api.Notifications;

public static class NotificationEndpoints
{
    public static void MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/notifications")
            .WithTags("Notifications")
            .RequireAuthorization();

        group.MapGet("/", ListInbox);
        group.MapGet("/unread-count", GetUnreadCount);
        group.MapPut("/{id:guid}/read", MarkAsRead);
        group.MapPut("/read-all", MarkAllAsRead);
    }

    private static async Task<IResult> ListInbox(
        HttpContext context,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromServices] AuthenticationService authService,
        [FromServices] INotificationService notificationService,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can access personal notifications.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await notificationService.ListInboxAsync(
            new ListNotificationsRequest(currentUser.User.Id, page ?? 1, pageSize ?? 10),
            ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetUnreadCount(
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] INotificationService notificationService,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can access personal notifications.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await notificationService.GetUnreadCountAsync(currentUser.User.Id, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> MarkAsRead(
        Guid id,
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] INotificationService notificationService,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can update personal notifications.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await notificationService.MarkAsReadAsync(
            new MarkNotificationAsReadRequest(currentUser.User.Id, id),
            ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "Notification not found.",
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found"),
            _ => Results.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static async Task<IResult> MarkAllAsRead(
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] INotificationService notificationService,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can update personal notifications.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await notificationService.MarkAllAsReadAsync(currentUser.User.Id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(new UnreadNotificationsCountResponse(result.Value)),
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
