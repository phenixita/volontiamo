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

    public async Task<PagedResult<ParticipantEventListItem>> ListParticipantEventsAsync(ParticipantEventListFilter filter, int page, int pageSize, CancellationToken ct = default)
    {
        var query =
            from eventItem in _db.Events
            join participationForUser in _db.EventParticipations.Where(p => p.UserId == filter.UserId)
                on eventItem.Id equals participationForUser.EventId into participationsForUser
            from participation in participationsForUser.DefaultIfEmpty()
            where eventItem.Status == EventStatus.Active
                && eventItem.StartAtUtc > filter.NowUtc
            select new
            {
                Event = eventItem,
                ParticipationStatus = participation == null
                    ? (EventParticipationStatus?)null
                    : participation.Status
            };

        query = filter.Mode == ParticipantEventListMode.Refused
            ? query.Where(item => item.ParticipationStatus == EventParticipationStatus.Refused)
            : query.Where(item => item.ParticipationStatus == null || item.ParticipationStatus == EventParticipationStatus.Accepted);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderBy(item => item.Event.StartAtUtc)
            .ThenBy(item => item.Event.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(item => new ParticipantEventListItem(item.Event, item.ParticipationStatus))
            .ToListAsync(ct);

        return new PagedResult<ParticipantEventListItem>(items, totalCount);
    }

    public async Task<EventParticipation?> GetParticipationAsync(int eventId, Guid userId, CancellationToken ct = default)
        => await _db.EventParticipations.FindAsync([eventId, userId], ct);

    public async Task AddParticipationAsync(EventParticipation participation, CancellationToken ct = default)
        => await _db.EventParticipations.AddAsync(participation, ct);

    public async Task AddAsync(Event eventItem, CancellationToken ct = default)
        => await _db.Events.AddAsync(eventItem, ct);

    public async Task SaveChangesAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);
}