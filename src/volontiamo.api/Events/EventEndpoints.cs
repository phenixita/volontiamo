using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using volontiamo.domain;

namespace volontiamo.api.Events;

public static class EventEndpoints
{
    public static void MapEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/events")
            .WithTags("Events")
            .RequireAuthorization();

        group.MapPost("/", CreateEvent);
        group.MapGet("/my", ListMyEvents);
        group.MapGet("/", ListEvents);
        group.MapGet("/{id:int}", GetEventDetail);
        group.MapPut("/{id:int}", UpdateEvent);
        group.MapPut("/{id:int}/participation/candidata", ApplyToEvent);
        group.MapPut("/{id:int}/participation/non-interessata", MarkEventAsNotInterested);
        group.MapDelete("/{id:int}/participation/non-interessata", RestoreEventAvailability);
        group.MapDelete("/{id:int}", DeleteEvent);
        group.MapPut("/{eventId:int}/candidates/{userId:guid}/accept", AcceptCandidate);
        group.MapPut("/{eventId:int}/candidates/{userId:guid}/reject", RejectCandidate);
        group.MapDelete("/{eventId:int}/candidates/{userId:guid}/reject", UndoRejectCandidate);
    }

    private static async Task<IResult> CreateEvent(
        [FromBody] CreateEventRequest request,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var result = await service.CreateAsync(request, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Created($"/api/v1/events/{result.Value!.Id}", result.Value),
            ResultStatus.ValidationError => Results.ValidationProblem(
                result.Errors.GroupBy(e => e.Field)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray())),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> ListEvents(
        HttpContext context,
        [FromQuery] string? name,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var statusParseResult = ParseStatuses(context.Request.Query["status"]);
        if (!statusParseResult.Ok)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = ["Status filter must be draft, active, concluded, all, or a numeric EventStatus value."]
            });
        }

        var request = new EventListRequest(
            name,
            statusParseResult.Statuses,
            page ?? 1,
            pageSize ?? 10);
        var result = await service.ListAsync(request, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> ListMyEvents(
        HttpContext context,
        [FromQuery] string? view,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromServices] AuthenticationService authService,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can access personal event participation.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        if (!TryParseParticipantView(view, out var mode))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["view"] = ["View must be available or non-interessata."]
            });
        }

        var request = new ParticipantEventListRequest(
            currentUser.User.Id,
            mode,
            page ?? 1,
            pageSize ?? 10);

        var result = await service.ListParticipantEventsAsync(request, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetEventDetail(
        int id,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var result = await service.GetDetailAsync(id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "Event not found.",
                statusCode: 404,
                title: "Not Found"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> ApplyToEvent(
        int id,
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can change event participation.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await service.ApplyAsync(id, currentUser.User.Id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "Event not found.",
                statusCode: 404,
                title: "Not Found"),
            ResultStatus.Conflict => Results.Problem(
                detail: result.ErrorMessage ?? "Event is not selectable.",
                statusCode: 409,
                title: "Conflict"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> MarkEventAsNotInterested(
        int id,
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can change event participation.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await service.MarkAsNotInterestedAsync(id, currentUser.User.Id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "Event not found.",
                statusCode: 404,
                title: "Not Found"),
            ResultStatus.Conflict => Results.Problem(
                detail: result.ErrorMessage ?? "Event participation cannot transition to NonInteressata.",
                statusCode: 409,
                title: "Conflict"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> RestoreEventAvailability(
        int id,
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Volontario)
        {
            return Results.Problem(
                detail: "Only volunteers can change event participation.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await service.RestoreAvailabilityAsync(id, currentUser.User.Id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "Event not found.",
                statusCode: 404,
                title: "Not Found"),
            ResultStatus.Conflict => Results.Problem(
                detail: result.ErrorMessage ?? "Availability cannot be restored for this event.",
                statusCode: 409,
                title: "Conflict"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> DeleteEvent(
        int id,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var result = await service.DeleteAsync(id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.NoContent(),
            ResultStatus.NotFound => Results.Problem(
                detail: "Event not found.",
                statusCode: 404,
                title: "Not Found"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> UpdateEvent(
        int id,
        [FromBody] UpdateEventRequest request,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(id, request, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.NoContent(),
            ResultStatus.NotFound => Results.Problem(
                detail: "Event not found.",
                statusCode: 404,
                title: "Not Found"),
            ResultStatus.ValidationError => Results.ValidationProblem(
                result.Errors.GroupBy(e => e.Field)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray())),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> AcceptCandidate(
        int eventId,
        Guid userId,
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Lilt)
        {
            return Results.Problem(
                detail: "Only backoffice users can manage event candidacies.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await service.AcceptCandidateAsync(eventId, userId, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.NoContent(),
            ResultStatus.NotFound => Results.Problem(detail: "Event not found.", statusCode: 404, title: "Not Found"),
            ResultStatus.Conflict => Results.Problem(detail: result.ErrorMessage, statusCode: 409, title: "Conflict"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> RejectCandidate(
        int eventId,
        Guid userId,
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Lilt)
        {
            return Results.Problem(
                detail: "Only backoffice users can manage event candidacies.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await service.RejectCandidateAsync(eventId, userId, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.NoContent(),
            ResultStatus.NotFound => Results.Problem(detail: "Event not found.", statusCode: 404, title: "Not Found"),
            ResultStatus.Conflict => Results.Problem(detail: result.ErrorMessage, statusCode: 409, title: "Conflict"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> UndoRejectCandidate(
        int eventId,
        Guid userId,
        HttpContext context,
        [FromServices] AuthenticationService authService,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        var currentUser = await GetCurrentUserAsync(context, authService, ct);
        if (currentUser.Error is not null)
            return currentUser.Error;

        if (currentUser.User!.UserType != UserType.Lilt)
        {
            return Results.Problem(
                detail: "Only backoffice users can manage event candidacies.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden");
        }

        var result = await service.UndoRejectCandidateAsync(eventId, userId, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.NoContent(),
            ResultStatus.NotFound => Results.Problem(detail: "Event not found.", statusCode: 404, title: "Not Found"),
            ResultStatus.Conflict => Results.Problem(detail: result.ErrorMessage, statusCode: 409, title: "Conflict"),
            _ => Results.StatusCode(500)
        };
    }

    private static StatusParseResult ParseStatuses(IReadOnlyList<string> rawValues)
    {
        if (rawValues.Count == 0)
            return StatusParseResult.Success(null);

        var statuses = new HashSet<EventStatus>();
        foreach (var rawValue in rawValues)
        {
            foreach (var token in rawValue.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            {
                if (string.Equals(token, "all", StringComparison.OrdinalIgnoreCase))
                    return StatusParseResult.Success(Enum.GetValues<EventStatus>().ToHashSet());

                if (int.TryParse(token, out var numericStatus) && Enum.IsDefined(typeof(EventStatus), numericStatus))
                {
                    statuses.Add((EventStatus)numericStatus);
                    continue;
                }

                if (Enum.TryParse<EventStatus>(token, ignoreCase: true, out var status) && Enum.IsDefined(status))
                {
                    statuses.Add(status);
                    continue;
                }

                return StatusParseResult.Failure();
            }
        }

        return StatusParseResult.Success(statuses.Count == 0 ? null : statuses);
    }

    private sealed record StatusParseResult(bool Ok, IReadOnlySet<EventStatus>? Statuses)
    {
        public static StatusParseResult Success(IReadOnlySet<EventStatus>? statuses) => new(true, statuses);
        public static StatusParseResult Failure() => new(false, null);
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

    private static bool TryParseParticipantView(string? view, out ParticipantEventListMode mode)
    {
        if (string.IsNullOrWhiteSpace(view) || string.Equals(view, "available", StringComparison.OrdinalIgnoreCase))
        {
            mode = ParticipantEventListMode.Available;
            return true;
        }

        if (string.Equals(view, "non-interessata", StringComparison.OrdinalIgnoreCase)
            || string.Equals(view, "noninteressata", StringComparison.OrdinalIgnoreCase))
        {
            mode = ParticipantEventListMode.NonInteressata;
            return true;
        }

        mode = ParticipantEventListMode.Available;
        return false;
    }

    private sealed record CurrentUserResolution(AuthenticatedUserResponse? User, IResult? Error);
}