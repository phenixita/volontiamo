namespace volontiamo.domain;

public record CreateEventRequest(
    string Name,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string? Location,
    string? OperationalNotesMarkdown,
    EventStatus Status);

public record EventListRequest(
    string? Name,
    IReadOnlySet<EventStatus>? Statuses,
    int Page,
    int PageSize);

public record EventResponse(
    int Id,
    string Name,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string? Location,
    string OperationalNotesMarkdown,
    EventStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public enum ParticipantEventListMode
{
    Available = 0,
    Refused = 1
}

public record ParticipantEventListRequest(
    Guid UserId,
    ParticipantEventListMode Mode,
    int Page,
    int PageSize);

public record ParticipantEventResponse(
    int Id,
    string Name,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string? Location,
    string OperationalNotesMarkdown,
    EventParticipationStatus? ParticipationStatus);

public record SetEventParticipationRequest(Guid UserId, EventParticipationStatus Status);

public sealed class EventService
{
    private static readonly IReadOnlySet<EventStatus> DefaultStatuses = new HashSet<EventStatus>
    {
        EventStatus.Draft,
        EventStatus.Active
    };

    private readonly IEventRepository _repository;
    private readonly TimeProvider _timeProvider;

    public EventService(IEventRepository repository, TimeProvider? timeProvider = null)
    {
        _repository = repository;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task<Result<EventResponse>> CreateAsync(CreateEventRequest request, CancellationToken ct = default)
    {
        var validationErrors = ValidateCreate(request);
        if (validationErrors.Count > 0)
            return Result<EventResponse>.ValidationFailure(validationErrors);

        var eventItem = Event.Create(
            request.Name,
            request.StartAtUtc,
            request.EndAtUtc,
            request.Location,
            request.OperationalNotesMarkdown,
            request.Status);

        await _repository.AddAsync(eventItem, ct);
        await _repository.SaveChangesAsync(ct);

        return Result<EventResponse>.Success(MapToResponse(eventItem));
    }

    public async Task<PagedResponse<EventResponse>> ListAsync(EventListRequest request, CancellationToken ct = default)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 10 : request.PageSize;
        if (pageSize > 100) pageSize = 100;

        var statuses = request.Statuses is null || request.Statuses.Count == 0
            ? DefaultStatuses
            : request.Statuses;

        var filter = new EventListFilter(
            string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim(),
            statuses);

        var result = await _repository.ListAsync(filter, page, pageSize, ct);
        var items = result.Items.Select(MapToResponse).ToList();
        return new PagedResponse<EventResponse>(items, page, pageSize, result.TotalCount);
    }

    public async Task<Result<bool>> DeleteAsync(int id, CancellationToken ct = default)
    {
        var eventItem = await _repository.GetByIdAsync(id, ct);
        if (eventItem is null)
            return Result<bool>.NotFound();

        eventItem.SoftDelete();
        await _repository.SaveChangesAsync(ct);

        return Result<bool>.Success(true);
    }

    public async Task<PagedResponse<ParticipantEventResponse>> ListParticipantEventsAsync(ParticipantEventListRequest request, CancellationToken ct = default)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 10 : request.PageSize;
        if (pageSize > 100) pageSize = 100;

        var filter = new ParticipantEventListFilter(
            request.UserId,
            request.Mode,
            _timeProvider.GetUtcNow().UtcDateTime);

        var result = await _repository.ListParticipantEventsAsync(filter, page, pageSize, ct);
        var items = result.Items.Select(MapToParticipantResponse).ToList();
        return new PagedResponse<ParticipantEventResponse>(items, page, pageSize, result.TotalCount);
    }

    public async Task<Result<ParticipantEventResponse>> SetParticipationAsync(int eventId, SetEventParticipationRequest request, CancellationToken ct = default)
    {
        var eventItem = await _repository.GetByIdAsync(eventId, ct);
        if (eventItem is null)
            return Result<ParticipantEventResponse>.NotFound();

        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;
        if (!IsSelectable(eventItem, nowUtc))
            return Result<ParticipantEventResponse>.Conflict("Event is not selectable.");

        var participation = await _repository.GetParticipationAsync(eventId, request.UserId, ct);
        if (participation is null)
        {
            participation = EventParticipation.Create(eventId, request.UserId, request.Status, nowUtc);
            await _repository.AddParticipationAsync(participation, ct);
        }
        else
        {
            participation.ChangeStatus(request.Status, nowUtc);
        }

        await _repository.SaveChangesAsync(ct);

        return Result<ParticipantEventResponse>.Success(MapToParticipantResponse(eventItem, participation.Status));
    }

    private static List<ValidationError> ValidateCreate(CreateEventRequest r)
    {
        var errors = new List<ValidationError>();
        if (string.IsNullOrWhiteSpace(r.Name))
            errors.Add(new("name", "Name is required."));
        if (r.StartAtUtc.Kind != DateTimeKind.Utc)
            errors.Add(new("startAtUtc", "Start date must be UTC."));
        if (r.EndAtUtc.Kind != DateTimeKind.Utc)
            errors.Add(new("endAtUtc", "End date must be UTC."));
        if (r.EndAtUtc < r.StartAtUtc)
            errors.Add(new("endAtUtc", "End date cannot be earlier than start date."));
        return errors;
    }

    private static EventResponse MapToResponse(Event eventItem)
    {
        return new EventResponse(
            eventItem.Id,
            eventItem.Name,
            eventItem.StartAtUtc,
            eventItem.EndAtUtc,
            eventItem.Location,
            eventItem.OperationalNotesMarkdown,
            eventItem.Status,
            eventItem.CreatedAt,
            eventItem.UpdatedAt);
    }

    private static bool IsSelectable(Event eventItem, DateTime nowUtc)
    {
        return eventItem.Status == EventStatus.Active
            && !eventItem.IsDeleted
            && eventItem.StartAtUtc > nowUtc;
    }

    private static ParticipantEventResponse MapToParticipantResponse(ParticipantEventListItem item)
    {
        return MapToParticipantResponse(item.Event, item.ParticipationStatus);
    }

    private static ParticipantEventResponse MapToParticipantResponse(Event eventItem, EventParticipationStatus? participationStatus)
    {
        return new ParticipantEventResponse(
            eventItem.Id,
            eventItem.Name,
            eventItem.StartAtUtc,
            eventItem.EndAtUtc,
            eventItem.Location,
            eventItem.OperationalNotesMarkdown,
            participationStatus);
    }
}