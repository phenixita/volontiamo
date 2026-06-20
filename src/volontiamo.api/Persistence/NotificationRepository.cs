using Microsoft.EntityFrameworkCore;
using volontiamo.domain;

namespace volontiamo.api.Persistence;

public sealed class NotificationRepository : INotificationRepository
{
    private readonly AppDbContext _db;

    public NotificationRepository(AppDbContext db) => _db = db;

    public async Task AddRangeAsync(IReadOnlyList<Notification> notifications, CancellationToken ct = default)
        => await _db.Notifications.AddRangeAsync(notifications, ct);

    public async Task<PagedResult<Notification>> ListByUserAsync(Guid userId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.Notifications.Where(notification => notification.UserId == userId);
        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(notification => notification.CreatedAt)
            .ThenByDescending(notification => notification.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<Notification>(items, totalCount);
    }

    public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.Notifications.FirstOrDefaultAsync(notification => notification.Id == id, ct);

    public async Task<IReadOnlyList<Notification>> ListUnreadByUserAsync(Guid userId, CancellationToken ct = default)
        => await _db.Notifications
            .Where(notification => notification.UserId == userId && notification.ReadAt == null)
            .OrderBy(notification => notification.CreatedAt)
            .ToListAsync(ct);

    public async Task<int> CountUnreadByUserAsync(Guid userId, CancellationToken ct = default)
        => await _db.Notifications.CountAsync(notification => notification.UserId == userId && notification.ReadAt == null, ct);

    public async Task SaveChangesAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);
}
