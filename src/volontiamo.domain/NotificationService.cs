namespace volontiamo.domain;

public interface INotificationService
{
    Task CreateEventCreatedNotificationsAsync(Event eventItem, CancellationToken ct = default);
    Task<PagedResponse<NotificationResponse>> ListInboxAsync(ListNotificationsRequest request, CancellationToken ct = default);
    Task<UnreadNotificationsCountResponse> GetUnreadCountAsync(Guid userId, CancellationToken ct = default);
    Task<Result<NotificationResponse>> MarkAsReadAsync(MarkNotificationAsReadRequest request, CancellationToken ct = default);
    Task<Result<int>> MarkAllAsReadAsync(Guid userId, CancellationToken ct = default);
}

public sealed class NotificationService : INotificationService
{
    private readonly INotificationRepository _repository;
    private readonly IUserRepository _userRepository;
    private readonly TimeProvider _timeProvider;

    public NotificationService(
        INotificationRepository repository,
        IUserRepository userRepository,
        TimeProvider? timeProvider = null)
    {
        _repository = repository;
        _userRepository = userRepository;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task CreateEventCreatedNotificationsAsync(Event eventItem, CancellationToken ct = default)
    {
        var users = await _userRepository.ListNotificationCandidatesAsync(ct);
        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;
        var notifications = users
            .Where(IsEligibleRecipient)
            .Select(user => Notification.CreateEventCreated(user.Id, eventItem, nowUtc))
            .ToList();

        if (notifications.Count == 0)
            return;

        await _repository.AddRangeAsync(notifications, ct);
    }

    public async Task<PagedResponse<NotificationResponse>> ListInboxAsync(ListNotificationsRequest request, CancellationToken ct = default)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 10 : request.PageSize;
        if (pageSize > 100) pageSize = 100;

        var result = await _repository.ListByUserAsync(request.UserId, page, pageSize, ct);
        return new PagedResponse<NotificationResponse>(
            result.Items.Select(MapToResponse).ToList(),
            page,
            pageSize,
            result.TotalCount);
    }

    public async Task<UnreadNotificationsCountResponse> GetUnreadCountAsync(Guid userId, CancellationToken ct = default)
    {
        var unreadCount = await _repository.CountUnreadByUserAsync(userId, ct);
        return new UnreadNotificationsCountResponse(unreadCount);
    }

    public async Task<Result<NotificationResponse>> MarkAsReadAsync(MarkNotificationAsReadRequest request, CancellationToken ct = default)
    {
        var notification = await _repository.GetByIdAsync(request.NotificationId, ct);
        if (notification is null || notification.UserId != request.UserId)
            return Result<NotificationResponse>.NotFound();

        notification.MarkAsRead(_timeProvider.GetUtcNow().UtcDateTime);
        await _repository.SaveChangesAsync(ct);
        return Result<NotificationResponse>.Success(MapToResponse(notification));
    }

    public async Task<Result<int>> MarkAllAsReadAsync(Guid userId, CancellationToken ct = default)
    {
        var notifications = await _repository.ListUnreadByUserAsync(userId, ct);
        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;

        foreach (var notification in notifications)
            notification.MarkAsRead(nowUtc);

        if (notifications.Count > 0)
            await _repository.SaveChangesAsync(ct);

        return Result<int>.Success(notifications.Count);
    }

    private static NotificationResponse MapToResponse(Notification notification)
    {
        return new NotificationResponse(
            notification.Id,
            notification.Kind,
            notification.Title,
            notification.Body,
            notification.EventId,
            notification.CreatedAt,
            notification.ReadAt);
    }

    private static bool IsEligibleRecipient(User user)
        => user.UserType == UserType.Volontario
            && user.IsActive
            && !user.IsDeleted;
}
