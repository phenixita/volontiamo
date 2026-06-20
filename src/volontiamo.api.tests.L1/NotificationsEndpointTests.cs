using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using volontiamo.api.Auth;
using volontiamo.api.Persistence;
using volontiamo.api.Users;
using volontiamo.domain;

namespace volontiamo.api.tests.L1;

public sealed class NotificationsEndpointTests : IClassFixture<PostgresWebApplicationFactory>
{
    private readonly PostgresWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public NotificationsEndpointTests(PostgresWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateEvent_WhenCreatedActive_PersistsNotificationsForActiveVolunteersOnly()
    {
        await AuthenticateAsSeedUserAsync();
        var activeVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");
        var inactiveVolunteer = await CreateUserCredentialsAsync($"inactive-{Guid.NewGuid():N}@volontiamo.local", isActive: false);
        var liltUser = await CreateUserCredentialsAsync($"lilt-{Guid.NewGuid():N}@volontiamo.local", userType: UserType.Lilt);

        var createdEvent = await CreateEventAsync(ValidCreateRequest(name: $"notif-{Guid.NewGuid():N}", status: EventStatus.Active));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var recipients = await db.Notifications
            .Where(notification => notification.EventId == createdEvent.Id)
            .Select(notification => notification.UserId)
            .ToListAsync();

        Assert.Contains(activeVolunteer.User.Id, recipients);
        Assert.DoesNotContain(inactiveVolunteer.User.Id, recipients);
        Assert.DoesNotContain(liltUser.User.Id, recipients);
    }

    [Fact]
    public async Task CreateEvent_WhenCreatedAsDraft_DoesNotPersistNotificationsUntilStatusBecomesActive()
    {
        await AuthenticateAsSeedUserAsync();
        var activeVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");
        var inactiveVolunteer = await CreateUserCredentialsAsync($"inactive-{Guid.NewGuid():N}@volontiamo.local", isActive: false);
        var liltUser = await CreateUserCredentialsAsync($"lilt-{Guid.NewGuid():N}@volontiamo.local", userType: UserType.Lilt);

        var createdEvent = await CreateEventAsync(ValidCreateRequest(name: $"notif-{Guid.NewGuid():N}", status: EventStatus.Draft));

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var recipientsAfterCreate = await db.Notifications
                .Where(notification => notification.EventId == createdEvent.Id)
                .Select(notification => notification.UserId)
                .ToListAsync();

            Assert.Empty(recipientsAfterCreate);
        }

        await UpdateEventAsync(createdEvent.Id, new UpdateEventRequest(
            Name: createdEvent.Name,
            StartAtUtc: createdEvent.StartAtUtc,
            EndAtUtc: createdEvent.EndAtUtc,
            Location: createdEvent.Location,
            OperationalNotesMarkdown: createdEvent.OperationalNotesMarkdown,
            Status: EventStatus.Active));

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var recipientsAfterActivation = await db.Notifications
                .Where(notification => notification.EventId == createdEvent.Id)
                .Select(notification => notification.UserId)
                .ToListAsync();

            Assert.Contains(activeVolunteer.User.Id, recipientsAfterActivation);
            Assert.DoesNotContain(inactiveVolunteer.User.Id, recipientsAfterActivation);
            Assert.DoesNotContain(liltUser.User.Id, recipientsAfterActivation);
        }
    }

    [Fact]
    public async Task InboxUnreadCountMarkReadAndMarkAllAreScopedToAuthenticatedVolunteer()
    {
        await AuthenticateAsSeedUserAsync();
        var firstVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");
        var secondVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");
        var firstEvent = await CreateEventAsync(ValidCreateRequest(name: $"notif-{Guid.NewGuid():N}-1", status: EventStatus.Active));
        var secondEvent = await CreateEventAsync(ValidCreateRequest(name: $"notif-{Guid.NewGuid():N}-2", status: EventStatus.Active));

        await AuthenticateAsAsync(firstVolunteer.Email, firstVolunteer.Password);
        var inboxResponse = await _client.GetAsync("/api/v1/notifications?page=1&pageSize=50");
        var unreadResponse = await _client.GetAsync("/api/v1/notifications/unread-count");

        Assert.Equal(HttpStatusCode.OK, inboxResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, unreadResponse.StatusCode);

        var inbox = await inboxResponse.Content.ReadFromJsonAsync<PagedResponse<NotificationResponse>>();
        var unread = await unreadResponse.Content.ReadFromJsonAsync<UnreadNotificationsCountResponse>();
        Assert.NotNull(inbox);
        Assert.NotNull(unread);

        var relevantNotifications = inbox!.Items
            .Where(item => item.EventId == firstEvent.Id || item.EventId == secondEvent.Id)
            .ToList();
        Assert.Equal(2, relevantNotifications.Count);
        Assert.Equal(2, unread!.UnreadCount);
        Assert.True(relevantNotifications.SequenceEqual(relevantNotifications.OrderByDescending(item => item.CreatedAt)));

        var markReadResponse = await _client.PutAsJsonAsync($"/api/v1/notifications/{relevantNotifications[0].Id}/read", new { });
        var unreadAfterSingleResponse = await _client.GetAsync("/api/v1/notifications/unread-count");
        Assert.Equal(HttpStatusCode.OK, markReadResponse.StatusCode);
        var unreadAfterSingle = await unreadAfterSingleResponse.Content.ReadFromJsonAsync<UnreadNotificationsCountResponse>();
        Assert.NotNull(unreadAfterSingle);
        Assert.Equal(1, unreadAfterSingle!.UnreadCount);

        await AuthenticateAsAsync(secondVolunteer.Email, secondVolunteer.Password);
        var secondVolunteerUnreadResponse = await _client.GetAsync("/api/v1/notifications/unread-count");
        var secondVolunteerUnread = await secondVolunteerUnreadResponse.Content.ReadFromJsonAsync<UnreadNotificationsCountResponse>();
        Assert.NotNull(secondVolunteerUnread);
        Assert.Equal(2, secondVolunteerUnread!.UnreadCount);

        await AuthenticateAsAsync(firstVolunteer.Email, firstVolunteer.Password);
        var markAllResponse = await _client.PutAsJsonAsync("/api/v1/notifications/read-all", new { });
        var unreadAfterAllResponse = await _client.GetAsync("/api/v1/notifications/unread-count");
        Assert.Equal(HttpStatusCode.OK, markAllResponse.StatusCode);
        var unreadAfterAll = await unreadAfterAllResponse.Content.ReadFromJsonAsync<UnreadNotificationsCountResponse>();
        Assert.NotNull(unreadAfterAll);
        Assert.Equal(0, unreadAfterAll!.UnreadCount);

        await AuthenticateAsAsync(secondVolunteer.Email, secondVolunteer.Password);
        var secondVolunteerUnreadAfterAllResponse = await _client.GetAsync("/api/v1/notifications/unread-count");
        var secondVolunteerUnreadAfterAll = await secondVolunteerUnreadAfterAllResponse.Content.ReadFromJsonAsync<UnreadNotificationsCountResponse>();
        Assert.NotNull(secondVolunteerUnreadAfterAll);
        Assert.Equal(2, secondVolunteerUnreadAfterAll!.UnreadCount);
    }

    [Fact]
    public async Task Notifications_ForLiltUser_ReturnForbidden()
    {
        await AuthenticateAsSeedUserAsync();

        var listResponse = await _client.GetAsync("/api/v1/notifications?page=1&pageSize=10");
        var unreadResponse = await _client.GetAsync("/api/v1/notifications/unread-count");
        var markAllResponse = await _client.PutAsJsonAsync("/api/v1/notifications/read-all", new { });

        Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, unreadResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, markAllResponse.StatusCode);
    }

    private async Task AuthenticateAsSeedUserAsync()
        => await AuthenticateAsAsync(PostgresWebApplicationFactory.SeedEmail, PostgresWebApplicationFactory.SeedPassword);

    private async Task AuthenticateAsAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new AuthenticateUserRequest(email, password));
        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login!.AccessToken);
    }

    private async Task<EventResponse> CreateEventAsync(CreateEventRequest request)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/events", request);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<EventResponse>())!;
    }

    private async Task UpdateEventAsync(int eventId, UpdateEventRequest request)
    {
        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventId}", request);
        response.EnsureSuccessStatusCode();
    }

    private async Task<TestUserCredentials> CreateUserCredentialsAsync(
        string email,
        UserType userType = UserType.Volontario,
        bool isActive = true)
    {
        const string password = "Volontiamo123!";
        var request = new CreateUserRequest(
            FirstName: "Vol",
            LastName: "Tester",
            Email: email,
            InitialPassword: password,
            Phone: "+390200000000",
            DateOfBirth: null,
            EnrollmentDate: DateOnly.FromDateTime(DateTime.UtcNow),
            EndDate: null,
            IsActive: isActive,
            UserType: userType,
            Occupation: userType == UserType.Volontario ? "Volontario" : "Operatore LILT");

        var response = await _client.PostAsJsonAsync("/api/v1/users", request);
        response.EnsureSuccessStatusCode();
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        return new TestUserCredentials(user!, password);
    }

    private static CreateEventRequest ValidCreateRequest(
        string? name = null,
        EventStatus status = EventStatus.Draft)
    {
        var start = DateTime.UtcNow.AddDays(20);
        return new CreateEventRequest(
            Name: name ?? $"Giornata prevenzione {Guid.NewGuid():N}",
            StartAtUtc: start,
            EndAtUtc: start.AddHours(4),
            Location: "Sede LILT",
            OperationalNotesMarkdown: "## Operativo\n- Accoglienza\n- Materiali",
            Status: status);
    }

    private sealed record TestUserCredentials(UserResponse User, string Password)
    {
        public string Email => User.Email;
    }
}
