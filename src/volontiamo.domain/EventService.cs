namespace volontiamo.domain;

public record CreateEventRequest(
    string Name,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string? Location,
    string? OperationalNotesMarkdown,
    EventStatus Status);

public record UpdateEventRequest(
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
    DateTime UpdatedAt,
    int CandidataParticipantsCount,
    int PartecipaParticipantsCount);

public record EventVolunteerResponse(
    Guid UserId,
    string FirstName,
    string LastName,
    string Email,
    string? Phone);

public record EventDetailResponse(
    int Id,
    string Name,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string? Location,
    string OperationalNotesMarkdown,
    EventStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<EventVolunteerResponse> CandidataParticipants,
    IReadOnlyList<EventVolunteerResponse> PartecipaParticipants,
    IReadOnlyList<EventVolunteerResponse> NonInteressataParticipants,
    IReadOnlyList<EventVolunteerResponse> RifiutataParticipants);

public enum ParticipantEventListMode
{
    Available = 0,
    NonInteressata = 1
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
        var validationErrors = ValidateEvent(request.Name, request.StartAtUtc, request.EndAtUtc);
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

        return Result<EventResponse>.Success(MapToResponse(eventItem, 0, 0));
    }

    public async Task<Result<bool>> UpdateAsync(int id, UpdateEventRequest request, CancellationToken ct = default)
    {
        var eventItem = await _repository.GetByIdAsync(id, ct);
        if (eventItem is null || eventItem.IsDeleted)
            return Result<bool>.NotFound();

        var validationErrors = ValidateEvent(request.Name, request.StartAtUtc, request.EndAtUtc);
        if (validationErrors.Count > 0)
            return Result<bool>.ValidationFailure(validationErrors);

        eventItem.Update(
            request.Name,
            request.StartAtUtc,
            request.EndAtUtc,
            request.Location,
            request.OperationalNotesMarkdown,
            request.Status);

        await _repository.SaveChangesAsync(ct);

        return Result<bool>.Success(true);
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
        var items = result.Items
            .Select(item => MapToResponse(item.Event, item.CandidataParticipantsCount, item.PartecipaParticipantsCount))
            .ToList();
        return new PagedResponse<EventResponse>(items, page, pageSize, result.TotalCount);
    }

    public async Task<Result<EventDetailResponse>> GetDetailAsync(int id, CancellationToken ct = default)
    {
        var detail = await _repository.GetDetailByIdAsync(id, ct);
        if (detail is null)
            return Result<EventDetailResponse>.NotFound();

        return Result<EventDetailResponse>.Success(MapToDetailResponse(detail));
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

    public async Task<Result<ParticipantEventResponse>> ApplyAsync(int eventId, Guid userId, CancellationToken ct = default)
    {
        var resolution = await GetSelectableEventAsync<ParticipantEventResponse>(eventId, ct);
        if (resolution.Error is not null)
            return resolution.Error;

        var participation = await _repository.GetParticipationAsync(eventId, userId, ct);
        if (participation is not null)
            return Result<ParticipantEventResponse>.Conflict(GetApplyConflictMessage(participation.Status));

        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;
        participation = EventParticipation.Create(eventId, userId, EventParticipationStatus.Candidata, nowUtc);
        await _repository.AddParticipationAsync(participation, ct);
        await _repository.SaveChangesAsync(ct);

        return Result<ParticipantEventResponse>.Success(MapToParticipantResponse(resolution.Event!, participation.Status));
    }

    public async Task<Result<ParticipantEventResponse>> MarkAsNotInterestedAsync(int eventId, Guid userId, CancellationToken ct = default)
    {
        var resolution = await GetSelectableEventAsync<ParticipantEventResponse>(eventId, ct);
        if (resolution.Error is not null)
            return resolution.Error;

        var participation = await _repository.GetParticipationAsync(eventId, userId, ct);
        if (participation is not null)
            return Result<ParticipantEventResponse>.Conflict(GetNotInterestedConflictMessage(participation.Status));

        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;
        participation = EventParticipation.Create(eventId, userId, EventParticipationStatus.NonInteressata, nowUtc);
        await _repository.AddParticipationAsync(participation, ct);
        await _repository.SaveChangesAsync(ct);

        return Result<ParticipantEventResponse>.Success(MapToParticipantResponse(resolution.Event!, participation.Status));
    }

    public async Task<Result<ParticipantEventResponse>> RestoreAvailabilityAsync(int eventId, Guid userId, CancellationToken ct = default)
    {
        var resolution = await GetSelectableEventAsync<ParticipantEventResponse>(eventId, ct);
        if (resolution.Error is not null)
            return resolution.Error;

        var participation = await _repository.GetParticipationAsync(eventId, userId, ct);
        if (participation is null || participation.Status != EventParticipationStatus.NonInteressata)
            return Result<ParticipantEventResponse>.Conflict("Only volunteers marked as NonInteressata can be restored.");

        await _repository.RemoveParticipationAsync(participation, ct);
        await _repository.SaveChangesAsync(ct);

        return Result<ParticipantEventResponse>.Success(MapToParticipantResponse(resolution.Event!, null));
    }

    public async Task<Result<bool>> AcceptCandidateAsync(int eventId, Guid userId, CancellationToken ct = default)
    {
        return await FinalizeCandidateAsync(eventId, userId, EventParticipationStatus.Partecipa, ct);
    }

    public async Task<Result<bool>> RejectCandidateAsync(int eventId, Guid userId, CancellationToken ct = default)
    {
        return await FinalizeCandidateAsync(eventId, userId, EventParticipationStatus.Rifiutata, ct);
    }

    public async Task<Result<bool>> UndoRejectCandidateAsync(int eventId, Guid userId, CancellationToken ct = default)
    {
        return await DeleteParticipationAsync(eventId, userId, ct);
    }

    public async Task<Result<bool>> DeleteParticipationAsync(int eventId, Guid userId, CancellationToken ct = default)
    {
        var eventItem = await _repository.GetByIdAsync(eventId, ct);
        if (eventItem is null || eventItem.IsDeleted)
            return Result<bool>.NotFound();

        var participation = await _repository.GetParticipationAsync(eventId, userId, ct);
        if (participation is null)
            return Result<bool>.Conflict("Event participation not found.");

        await _repository.RemoveParticipationAsync(participation, ct);
        await _repository.SaveChangesAsync(ct);

        return Result<bool>.Success(true);
    }

    private static List<ValidationError> ValidateEvent(string name, DateTime startAtUtc, DateTime endAtUtc)
    {
        var errors = new List<ValidationError>();
        if (string.IsNullOrWhiteSpace(name))
            errors.Add(new("name", "Name is required."));
        if (startAtUtc.Kind != DateTimeKind.Utc)
            errors.Add(new("startAtUtc", "Start date must be UTC."));
        if (endAtUtc.Kind != DateTimeKind.Utc)
            errors.Add(new("endAtUtc", "End date must be UTC."));
        if (endAtUtc < startAtUtc)
            errors.Add(new("endAtUtc", "End date cannot be earlier than start date."));
        return errors;
    }

    private async Task<Result<bool>> FinalizeCandidateAsync(
        int eventId,
        Guid userId,
        EventParticipationStatus finalStatus,
        CancellationToken ct)
    {
        var resolution = await GetSelectableEventAsync<bool>(eventId, ct);
        if (resolution.Error is not null)
            return resolution.Error;

        var participation = await _repository.GetParticipationAsync(eventId, userId, ct);
        if (participation is null || participation.Status != EventParticipationStatus.Candidata)
            return Result<bool>.Conflict("Only candidacies can transition to a final event participation state.");

        participation.ChangeStatus(finalStatus, _timeProvider.GetUtcNow().UtcDateTime);
        await _repository.SaveChangesAsync(ct);

        return Result<bool>.Success(true);
    }

    private async Task<SelectableEventResolution<TResult>> GetSelectableEventAsync<TResult>(int eventId, CancellationToken ct)
    {
        var eventItem = await _repository.GetByIdAsync(eventId, ct);
        if (eventItem is null || eventItem.IsDeleted)
            return SelectableEventResolution<TResult>.NotFound();

        if (!IsSelectable(eventItem, _timeProvider.GetUtcNow().UtcDateTime))
            return SelectableEventResolution<TResult>.Conflict("Event is not selectable.");

        return SelectableEventResolution<TResult>.Success(eventItem);
    }

    private static string GetApplyConflictMessage(EventParticipationStatus status)
    {
        return status switch
        {
            EventParticipationStatus.Candidata => "Volunteer is already a candidate for this event.",
            EventParticipationStatus.Partecipa => "Volunteer participation is already final.",
            EventParticipationStatus.Rifiutata => "Volunteer participation was already rejected.",
            EventParticipationStatus.NonInteressata => "Availability must be restored before applying to this event.",
            _ => "Event participation cannot transition to Candidata."
        };
    }

    private static string GetNotInterestedConflictMessage(EventParticipationStatus status)
    {
        return status switch
        {
            EventParticipationStatus.Candidata => "Candidate volunteers cannot be marked as NonInteressata.",
            EventParticipationStatus.Partecipa => "Confirmed participants cannot be marked as NonInteressata.",
            EventParticipationStatus.Rifiutata => "Rejected participations are final for this event.",
            EventParticipationStatus.NonInteressata => "Volunteer is already marked as NonInteressata for this event.",
            _ => "Event participation cannot transition to NonInteressata."
        };
    }

    private static EventResponse MapToResponse(Event eventItem, int candidataParticipantsCount, int partecipaParticipantsCount)
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
            eventItem.UpdatedAt,
            candidataParticipantsCount,
            partecipaParticipantsCount);
    }

    private static EventDetailResponse MapToDetailResponse(EventDetailItem detail)
    {
        var candidataParticipants = MapParticipants(detail.Participants, EventParticipationStatus.Candidata);
        var partecipaParticipants = MapParticipants(detail.Participants, EventParticipationStatus.Partecipa);
        var nonInteressataParticipants = MapParticipants(detail.Participants, EventParticipationStatus.NonInteressata);
        var rifiutataParticipants = MapParticipants(detail.Participants, EventParticipationStatus.Rifiutata);

        return new EventDetailResponse(
            detail.Event.Id,
            detail.Event.Name,
            detail.Event.StartAtUtc,
            detail.Event.EndAtUtc,
            detail.Event.Location,
            detail.Event.OperationalNotesMarkdown,
            detail.Event.Status,
            detail.Event.CreatedAt,
            detail.Event.UpdatedAt,
            candidataParticipants,
            partecipaParticipants,
            nonInteressataParticipants,
            rifiutataParticipants);
    }

    private static IReadOnlyList<EventVolunteerResponse> MapParticipants(
        IReadOnlyList<EventParticipant> participants,
        EventParticipationStatus status)
    {
        return participants
            .Where(participant => participant.ParticipationStatus == status)
            .Select(MapToVolunteerResponse)
            .ToList();
    }

    private static EventVolunteerResponse MapToVolunteerResponse(EventParticipant participant)
    {
        return new EventVolunteerResponse(
            participant.UserId,
            participant.FirstName,
            participant.LastName,
            participant.Email,
            participant.Phone);
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

    private sealed record SelectableEventResolution<TResult>(Event? Event, Result<TResult>? Error)
    {
        public static SelectableEventResolution<TResult> Success(Event eventItem) => new(eventItem, null);
        public static SelectableEventResolution<TResult> NotFound() => new(null, Result<TResult>.NotFound());
        public static SelectableEventResolution<TResult> Conflict(string message) => new(null, Result<TResult>.Conflict(message));
    }
}