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
        group.MapGet("/", ListEvents);
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
}