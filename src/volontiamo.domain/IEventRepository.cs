namespace volontiamo.domain;

public record EventListFilter(string? Name, IReadOnlySet<EventStatus> Statuses);

public interface IEventRepository
{
    Task<Event?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<PagedResult<Event>> ListAsync(EventListFilter filter, int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Event eventItem, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}