using Microsoft.EntityFrameworkCore;
using volontiamo.domain;

namespace volontiamo.api.Persistence;

public class EventRepository : IEventRepository
{
    private readonly AppDbContext _db;

    public EventRepository(AppDbContext db) => _db = db;

    public async Task<Event?> GetByIdAsync(int id, CancellationToken ct = default)
        => await _db.Events.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<PagedResult<Event>> ListAsync(EventListFilter filter, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.Events.AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            var name = filter.Name.Trim().ToLowerInvariant();
            query = query.Where(e => e.Name.ToLower().Contains(name));
        }

        if (filter.Statuses.Count > 0)
        {
            query = query.Where(e => filter.Statuses.Contains(e.Status));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderBy(e => e.StartAtUtc)
            .ThenBy(e => e.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<Event>(items, totalCount);
    }

    public async Task AddAsync(Event eventItem, CancellationToken ct = default)
        => await _db.Events.AddAsync(eventItem, ct);

    public async Task SaveChangesAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);
}