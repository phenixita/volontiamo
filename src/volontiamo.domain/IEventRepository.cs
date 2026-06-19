namespace volontiamo.domain;

public record EventListFilter(string? Name, IReadOnlySet<EventStatus> Statuses);

public record ParticipantEventListFilter(Guid UserId, ParticipantEventListMode Mode, DateTime NowUtc);

public record ParticipantEventListItem(Event Event, EventParticipationStatus? ParticipationStatus);

public interface IEventRepository
{
    Task<Event?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<PagedResult<Event>> ListAsync(EventListFilter filter, int page, int pageSize, CancellationToken ct = default);
    Task<PagedResult<ParticipantEventListItem>> ListParticipantEventsAsync(ParticipantEventListFilter filter, int page, int pageSize, CancellationToken ct = default);
    Task<EventParticipation?> GetParticipationAsync(int eventId, Guid userId, CancellationToken ct = default);
    Task AddParticipationAsync(EventParticipation participation, CancellationToken ct = default);
    Task AddAsync(Event eventItem, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}