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
        group.MapPut("/{id:int}/participation", SetParticipation);
        group.MapDelete("/{id:int}", DeleteEvent);
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
        [FromServices] EventService service,
        CancellationToken ct)
    {
        if (!TryGetCurrentUserId(context, out var userId))
            return Results.Unauthorized();

        if (!TryParseParticipantView(view, out var mode))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["view"] = ["View must be available or refused."]
            });
        }

        var request = new ParticipantEventListRequest(
            userId,
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

    private static async Task<IResult> SetParticipation(
        int id,
        HttpContext context,
        [FromBody] EventParticipationStatusRequest request,
        [FromServices] EventService service,
        CancellationToken ct)
    {
        if (!TryGetCurrentUserId(context, out var userId))
            return Results.Unauthorized();

        if (!TryParseParticipationStatus(request.Status, out var status))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = ["Status must be Accepted or Refused."]
            });
        }

        var result = await service.SetParticipationAsync(id, new SetEventParticipationRequest(userId, status), ct);
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

    private static bool TryGetCurrentUserId(HttpContext context, out Guid userId)
    {
        var claimValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claimValue, out userId);
    }

    private static bool TryParseParticipantView(string? view, out ParticipantEventListMode mode)
    {
        if (string.IsNullOrWhiteSpace(view) || string.Equals(view, "available", StringComparison.OrdinalIgnoreCase))
        {
            mode = ParticipantEventListMode.Available;
            return true;
        }

        if (string.Equals(view, "refused", StringComparison.OrdinalIgnoreCase))
        {
            mode = ParticipantEventListMode.Refused;
            return true;
        }

        mode = ParticipantEventListMode.Available;
        return false;
    }

    private static bool TryParseParticipationStatus(string? rawStatus, out EventParticipationStatus status)
    {
        if (Enum.TryParse<EventParticipationStatus>(rawStatus, ignoreCase: true, out status) && Enum.IsDefined(status))
            return true;

        status = EventParticipationStatus.Accepted;
        return false;
    }

    private sealed record EventParticipationStatusRequest(string? Status);
}