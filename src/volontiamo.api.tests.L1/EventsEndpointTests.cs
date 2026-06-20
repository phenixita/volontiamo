using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using volontiamo.api.Auth;
using volontiamo.api.Persistence;
using volontiamo.api.Users;
using volontiamo.domain;

namespace volontiamo.api.tests.L1;

public sealed class EventsEndpointTests : IClassFixture<PostgresWebApplicationFactory>
{
    private readonly PostgresWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public EventsEndpointTests(PostgresWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Events_WithoutBearerToken_ReturnsUnauthorized()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var response = await _client.GetAsync("/api/v1/events");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_ValidEvent_ReturnsCreatedWithNumericId()
    {
        await AuthenticateAsSeedUserAsync();

        var response = await _client.PostAsJsonAsync("/api/v1/events", ValidCreateRequest());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var eventItem = await response.Content.ReadFromJsonAsync<EventResponse>();
        Assert.NotNull(eventItem);
        Assert.True(eventItem!.Id > 0);
        Assert.Equal(0, eventItem.CandidataParticipantsCount);
        Assert.Equal(0, eventItem.PartecipaParticipantsCount);
    }

    [Fact]
    public async Task List_DefaultIncludesDraftAndActiveButExcludesConcluded()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");

        var draft = await CreateEventAsync(ValidCreateRequest(name: $"{token} draft", status: EventStatus.Draft));
        var active = await CreateEventAsync(ValidCreateRequest(name: $"{token} active", status: EventStatus.Active));
        var concluded = await CreateEventAsync(ValidCreateRequest(name: $"{token} concluded", status: EventStatus.Concluded));

        var response = await _client.GetAsync($"/api/v1/events?name={token}&page=1&pageSize=20");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = await response.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.NotNull(page);
        var ids = page!.Items.Select(item => item.Id).ToHashSet();
        Assert.Contains(draft.Id, ids);
        Assert.Contains(active.Id, ids);
        Assert.DoesNotContain(concluded.Id, ids);
    }

    [Fact]
    public async Task MyEvents_AvailableAndNonInteressataViewsReflectVolunteerState()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var available = await CreateEventAsync(ValidCreateRequest(name: $"{token} available", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var candidata = await CreateEventAsync(ValidCreateRequest(name: $"{token} candidata", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(11)));
        var nonInteressata = await CreateEventAsync(ValidCreateRequest(name: $"{token} non interessata", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(12)));

        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");
        await AuthenticateAsAsync(volunteer.Email, volunteer.Password);
        await ApplyForEventAsync(candidata.Id);
        await MarkEventNotInterestedAsync(nonInteressata.Id);

        var availableResponse = await _client.GetAsync("/api/v1/events/my?page=1&pageSize=50");
        var nonInteressataResponse = await _client.GetAsync("/api/v1/events/my?view=non-interessata&page=1&pageSize=50");

        Assert.Equal(HttpStatusCode.OK, availableResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, nonInteressataResponse.StatusCode);

        var availablePage = await availableResponse.Content.ReadFromJsonAsync<PagedResponse<ParticipantEventResponse>>();
        var nonInteressataPage = await nonInteressataResponse.Content.ReadFromJsonAsync<PagedResponse<ParticipantEventResponse>>();
        Assert.NotNull(availablePage);
        Assert.NotNull(nonInteressataPage);

        var availableItems = availablePage!.Items.Where(item => item.Name.Contains(token, StringComparison.Ordinal)).ToList();
        Assert.Equal(2, availableItems.Count);
        Assert.Contains(availableItems, item => item.Id == available.Id && item.ParticipationStatus is null);
        Assert.Contains(availableItems, item => item.Id == candidata.Id && item.ParticipationStatus == EventParticipationStatus.Candidata);

        var nonInteressataItems = nonInteressataPage!.Items.Where(item => item.Name.Contains(token, StringComparison.Ordinal)).ToList();
        var excluded = Assert.Single(nonInteressataItems);
        Assert.Equal(nonInteressata.Id, excluded.Id);
        Assert.Equal(EventParticipationStatus.NonInteressata, excluded.ParticipationStatus);
    }

    [Fact]
    public async Task ParticipationEndpoints_ApplyMarkNotInterestedAndRestoreReturnUpdatedState()
    {
        await AuthenticateAsSeedUserAsync();
        var candidateEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var notInterestedEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(11)));

        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");
        await AuthenticateAsAsync(volunteer.Email, volunteer.Password);

        var candidata = await ApplyForEventAsync(candidateEvent.Id);
        var nonInteressata = await MarkEventNotInterestedAsync(notInterestedEvent.Id);
        var restored = await RestoreEventAvailabilityAsync(notInterestedEvent.Id);

        Assert.Equal(EventParticipationStatus.Candidata, candidata.ParticipationStatus);
        Assert.Equal(EventParticipationStatus.NonInteressata, nonInteressata.ParticipationStatus);
        Assert.Null(restored.ParticipationStatus);
    }

    [Fact]
    public async Task ListAndDetail_ExposeCandidateAndParticipantBreakdowns()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} dettaglio", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var candidataVolunteer = await CreateUserCredentialsAsync($"cand-{Guid.NewGuid():N}@volontiamo.local");
        await AuthenticateAsAsync(candidataVolunteer.Email, candidataVolunteer.Password);
        await ApplyForEventAsync(eventItem.Id);

        await AuthenticateAsSeedUserAsync();
        var partecipaVolunteer = await CreateUserCredentialsAsync($"part-{Guid.NewGuid():N}@volontiamo.local");
        var rifiutataVolunteer = await CreateUserCredentialsAsync($"rif-{Guid.NewGuid():N}@volontiamo.local");
        var nonInteressataVolunteer = await CreateUserCredentialsAsync($"noi-{Guid.NewGuid():N}@volontiamo.local");
        await InsertParticipationAsync(eventItem.Id, partecipaVolunteer.User.Id, EventParticipationStatus.Partecipa);
        await InsertParticipationAsync(eventItem.Id, rifiutataVolunteer.User.Id, EventParticipationStatus.Rifiutata);
        await InsertParticipationAsync(eventItem.Id, nonInteressataVolunteer.User.Id, EventParticipationStatus.NonInteressata);

        var listResponse = await _client.GetAsync($"/api/v1/events?name={token}&status=active&page=1&pageSize=20");
        var detailResponse = await _client.GetAsync($"/api/v1/events/{eventItem.Id}");

        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);

        var page = await listResponse.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        var detail = await detailResponse.Content.ReadFromJsonAsync<EventDetailResponse>();
        Assert.NotNull(page);
        Assert.NotNull(detail);

        var listed = Assert.Single(page!.Items);
        Assert.Equal(1, listed.CandidataParticipantsCount);
        Assert.Equal(1, listed.PartecipaParticipantsCount);
        Assert.Single(detail!.CandidataParticipants);
        Assert.Single(detail.PartecipaParticipants);
        Assert.Single(detail.NonInteressataParticipants);
        Assert.Single(detail.RifiutataParticipants);
    }

    [Fact]
    public async Task VolunteerOnlyEventEndpoints_RejectLiltUsers()
    {
        await AuthenticateAsSeedUserAsync();
        var eventItem = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var myEventsResponse = await _client.GetAsync("/api/v1/events/my?page=1&pageSize=10");
        var candidataResponse = await _client.PutAsJsonAsync($"/api/v1/events/{eventItem.Id}/participation/candidata", new { });

        Assert.Equal(HttpStatusCode.Forbidden, myEventsResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, candidataResponse.StatusCode);
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

    private async Task<ParticipantEventResponse> ApplyForEventAsync(int eventId)
    {
        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventId}/participation/candidata", new { });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ParticipantEventResponse>())!;
    }

    private async Task<ParticipantEventResponse> MarkEventNotInterestedAsync(int eventId)
    {
        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventId}/participation/non-interessata", new { });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ParticipantEventResponse>())!;
    }

    private async Task<ParticipantEventResponse> RestoreEventAvailabilityAsync(int eventId)
    {
        var response = await _client.DeleteAsync($"/api/v1/events/{eventId}/participation/non-interessata");
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ParticipantEventResponse>())!;
    }

    private async Task InsertParticipationAsync(int eventId, Guid userId, EventParticipationStatus status)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.EventParticipations.Add(EventParticipation.Create(eventId, userId, status, DateTime.UtcNow));
        await db.SaveChangesAsync();
    }

    private async Task<UserResponse> CreateUserAsync(
        string email,
        string password,
        UserType userType = UserType.Volontario,
        bool isActive = true)
    {
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
        return (await response.Content.ReadFromJsonAsync<UserResponse>())!;
    }

    private async Task<TestUserCredentials> CreateUserCredentialsAsync(
        string email,
        UserType userType = UserType.Volontario,
        bool isActive = true)
    {
        const string password = "Volontiamo123!";
        var user = await CreateUserAsync(email, password, userType, isActive);
        return new TestUserCredentials(user, password);
    }

    private static CreateEventRequest ValidCreateRequest(
        string? name = null,
        EventStatus status = EventStatus.Draft,
        DateTime? startAtUtc = null)
    {
        var start = startAtUtc ?? Utc(2026, 8, 1, 8);
        return new CreateEventRequest(
            Name: name ?? $"Giornata prevenzione {Guid.NewGuid():N}",
            StartAtUtc: start,
            EndAtUtc: start.AddHours(4),
            Location: "Sede LILT",
            OperationalNotesMarkdown: "## Operativo\n- Accoglienza\n- Materiali",
            Status: status);
    }

    private static DateTime Utc(int year, int month, int day, int hour)
        => new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    private sealed record TestUserCredentials(UserResponse User, string Password)
    {
        public string Email => User.Email;
    }
}
