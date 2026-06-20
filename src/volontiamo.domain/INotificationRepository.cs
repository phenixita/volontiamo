namespace volontiamo.domain;

public record ListNotificationsRequest(Guid UserId, int Page, int PageSize);

public record MarkNotificationAsReadRequest(Guid UserId, Guid NotificationId);

public record NotificationResponse(
    Guid Id,
    NotificationKind Kind,
    string Title,
    string Body,
    int EventId,
    DateTime CreatedAt,
    DateTime? ReadAt);

public record UnreadNotificationsCountResponse(int UnreadCount);

public interface INotificationRepository
{
    Task AddRangeAsync(IReadOnlyList<Notification> notifications, CancellationToken ct = default);
    Task<PagedResult<Notification>> ListByUserAsync(Guid userId, int page, int pageSize, CancellationToken ct = default);
    Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Notification>> ListUnreadByUserAsync(Guid userId, CancellationToken ct = default);
    Task<int> CountUnreadByUserAsync(Guid userId, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
