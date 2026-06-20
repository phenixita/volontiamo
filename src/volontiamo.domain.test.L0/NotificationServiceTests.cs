using volontiamo.domain;

namespace volontiamo.domain.test.L0;

public sealed class NotificationServiceTests
{
    private static readonly DateTime FixedNowUtc = Utc(2026, 6, 20, 9);

    [Fact]
    public async Task CreateEventCreatedNotificationsAsync_CreatesSnapshotsForActiveVolunteersOnly()
    {
        var volunteer = CreateUser(UserType.Volontario, isActive: true, isDeleted: false);
        var inactiveVolunteer = CreateUser(UserType.Volontario, isActive: false, isDeleted: false);
        var deletedVolunteer = CreateUser(UserType.Volontario, isActive: true, isDeleted: true);
        var liltUser = CreateUser(UserType.Lilt, isActive: true, isDeleted: false);
        var userRepository = new FakeUserRepository
        {
            NotificationCandidates = [volunteer, inactiveVolunteer, deletedVolunteer, liltUser]
        };
        var notificationRepository = new FakeNotificationRepository();
        var service = CreateService(notificationRepository, userRepository);
        var eventItem = CreateEvent(id: 44, name: "Giornata prevenzione", location: "Sede LILT");

        await service.CreateEventCreatedNotificationsAsync(eventItem);

        var notification = Assert.Single(notificationRepository.AddedNotifications);
        Assert.Equal(volunteer.Id, notification.UserId);
        Assert.Equal(NotificationKind.EventCreated, notification.Kind);
        Assert.Equal(eventItem.Id, notification.EventId);
        Assert.Equal(eventItem.Name, notification.Title);
        Assert.Contains("Sede LILT", notification.Body);
        Assert.Contains("20/06/2026", notification.Body);
    }

    [Fact]
    public async Task MarkAsReadAsync_UpdatesOnlyOwnedNotification()
    {
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var ownerNotification = Notification.CreateEventCreated(ownerId, CreateEvent(id: 71), FixedNowUtc);
        var otherNotification = Notification.CreateEventCreated(otherUserId, CreateEvent(id: 72), FixedNowUtc);
        var repository = new FakeNotificationRepository
        {
            Notifications = [ownerNotification, otherNotification]
        };
        var service = CreateService(repository);

        var result = await service.MarkAsReadAsync(new MarkNotificationAsReadRequest(ownerId, ownerNotification.Id));

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(ownerNotification.ReadAt);
        Assert.Null(otherNotification.ReadAt);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task MarkAllAsReadAsync_UpdatesOnlyUnreadNotificationsOfCaller()
    {
        var callerId = Guid.NewGuid();
        var alreadyRead = Notification.CreateEventCreated(callerId, CreateEvent(id: 81), FixedNowUtc);
        alreadyRead.MarkAsRead(FixedNowUtc.AddMinutes(1));
        var unread = Notification.CreateEventCreated(callerId, CreateEvent(id: 82), FixedNowUtc);
        var otherUserUnread = Notification.CreateEventCreated(Guid.NewGuid(), CreateEvent(id: 83), FixedNowUtc);
        var repository = new FakeNotificationRepository
        {
            Notifications = [alreadyRead, unread, otherUserUnread]
        };
        var service = CreateService(repository);

        var result = await service.MarkAllAsReadAsync(callerId);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.Equal(1, result.Value);
        Assert.NotNull(unread.ReadAt);
        Assert.NotNull(alreadyRead.ReadAt);
        Assert.Null(otherUserUnread.ReadAt);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task GetUnreadCountAsync_CountsOnlyUnreadNotificationsOfCaller()
    {
        var callerId = Guid.NewGuid();
        var firstUnread = Notification.CreateEventCreated(callerId, CreateEvent(id: 91), FixedNowUtc);
        var secondUnread = Notification.CreateEventCreated(callerId, CreateEvent(id: 92), FixedNowUtc);
        var read = Notification.CreateEventCreated(callerId, CreateEvent(id: 93), FixedNowUtc);
        read.MarkAsRead(FixedNowUtc.AddMinutes(1));
        var otherUserUnread = Notification.CreateEventCreated(Guid.NewGuid(), CreateEvent(id: 94), FixedNowUtc);
        var repository = new FakeNotificationRepository
        {
            Notifications = [firstUnread, secondUnread, read, otherUserUnread]
        };
        var service = CreateService(repository);

        var result = await service.GetUnreadCountAsync(callerId);

        Assert.Equal(2, result.UnreadCount);
    }

    private static NotificationService CreateService(
        FakeNotificationRepository repository,
        FakeUserRepository? userRepository = null)
    {
        return new NotificationService(
            repository,
            userRepository ?? new FakeUserRepository(),
            new FixedTimeProvider(FixedNowUtc));
    }

    private static Event CreateEvent(
        int id,
        string name = "Evento creato",
        string? location = null)
    {
        var startAtUtc = Utc(2026, 6, 20, 18);
        var eventItem = Event.Create(name, startAtUtc, startAtUtc.AddHours(4), location, "Note", EventStatus.Active);
        typeof(Event).GetProperty(nameof(Event.Id))!.SetValue(eventItem, id);
        return eventItem;
    }

    private static User CreateUser(UserType userType, bool isActive, bool isDeleted)
    {
        var user = User.Create(
            "Nome",
            "Cognome",
            $"{Guid.NewGuid():N}@volontiamo.local",
            null,
            null,
            new DateOnly(2025, 1, 1),
            null,
            isActive,
            userType,
            "Occupazione",
            "hash");

        if (isDeleted)
            user.SoftDelete();

        return user;
    }

    private static DateTime Utc(int year, int month, int day, int hour)
        => new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    private sealed class FakeNotificationRepository : INotificationRepository
    {
        public List<Notification> Notifications { get; set; } = [];
        public List<Notification> AddedNotifications { get; } = [];
        public int SaveChangesCallCount { get; private set; }

        public Task AddRangeAsync(IReadOnlyList<Notification> notifications, CancellationToken ct = default)
        {
            AddedNotifications.AddRange(notifications);
            Notifications.AddRange(notifications);
            return Task.CompletedTask;
        }

        public Task<PagedResult<Notification>> ListByUserAsync(Guid userId, int page, int pageSize, CancellationToken ct = default)
        {
            var ordered = Notifications
                .Where(notification => notification.UserId == userId)
                .OrderByDescending(notification => notification.CreatedAt)
                .ToList();
            var items = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            return Task.FromResult(new PagedResult<Notification>(items, ordered.Count));
        }

        public Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult(Notifications.FirstOrDefault(notification => notification.Id == id));

        public Task<IReadOnlyList<Notification>> ListUnreadByUserAsync(Guid userId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<Notification>>(Notifications.Where(notification => notification.UserId == userId && notification.ReadAt is null).ToList());

        public Task<int> CountUnreadByUserAsync(Guid userId, CancellationToken ct = default)
            => Task.FromResult(Notifications.Count(notification => notification.UserId == userId && notification.ReadAt is null));

        public Task SaveChangesAsync(CancellationToken ct = default)
        {
            SaveChangesCallCount++;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeUserRepository : IUserRepository
    {
        public IReadOnlyList<User> NotificationCandidates { get; set; } = [];

        public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) => Task.FromResult<User?>(null);
        public Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken ct = default) => Task.FromResult<User?>(null);
        public Task<PagedResult<User>> ListAsync(int page, int pageSize, CancellationToken ct = default) => Task.FromResult(new PagedResult<User>([], 0));
        public Task<bool> ExistsByEmailAsync(string normalizedEmail, Guid? excludeId = null, CancellationToken ct = default) => Task.FromResult(false);
        public Task AddAsync(User user, CancellationToken ct = default) => Task.CompletedTask;
        public Task SaveChangesAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<IReadOnlyList<User>> ListNotificationCandidatesAsync(CancellationToken ct = default) => Task.FromResult(NotificationCandidates);
    }

    private sealed class FixedTimeProvider(DateTime nowUtc) : TimeProvider
    {
        private readonly DateTimeOffset _now = new(nowUtc);

        public override DateTimeOffset GetUtcNow() => _now;
    }
}
