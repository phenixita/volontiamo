using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using volontiamo.api.Auth;
using volontiamo.api.Persistence;
using volontiamo.api.Users;
using volontiamo.domain;

namespace volontiamo.api.tests.L1;

public sealed class ReportingEndpointTests : IClassFixture<PostgresWebApplicationFactory>
{
    private readonly PostgresWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ReportingEndpointTests(PostgresWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Summary_ForStaffAggregatesConcludedEventsAndPartecipaHours()
    {
        await AuthenticateAsSeedUserAsync();
        var firstVolunteer = await CreateVolunteerAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");
        var secondVolunteer = await CreateVolunteerAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");

        var firstEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: Utc(2026, 7, 10, 8), durationHours: 4));
        var secondEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: Utc(2026, 7, 11, 9), durationHours: 2));

        await InsertParticipationAsync(firstEvent.Id, firstVolunteer.User.Id, EventParticipationStatus.Partecipa);
        await InsertParticipationAsync(firstEvent.Id, secondVolunteer.User.Id, EventParticipationStatus.Partecipa);
        await InsertParticipationAsync(secondEvent.Id, firstVolunteer.User.Id, EventParticipationStatus.Partecipa);

        await UpdateEventStatusAsync(firstEvent.Id, firstEvent.Name, Utc(2026, 7, 10, 8), 4, EventStatus.Concluded);
        await UpdateEventStatusAsync(secondEvent.Id, secondEvent.Name, Utc(2026, 7, 11, 9), 2, EventStatus.Concluded);

        var response = await _client.GetAsync($"/api/v1/reports/summary?from={Uri.EscapeDataString(Utc(2026, 7, 1, 0).ToString("O"))}&to={Uri.EscapeDataString(Utc(2026, 7, 31, 23).ToString("O"))}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await response.Content.ReadFromJsonAsync<ReportingSummaryResponse>();
        Assert.NotNull(summary);
        Assert.Equal(10m, summary!.TotalHours);
        Assert.Equal(2, summary.ConcludedEventsCount);
        Assert.Equal(2, summary.VolunteersCount);
    }

    [Fact]
    public async Task Me_ForVolunteerReturnsLifetimeHoursEventCountAndRank()
    {
        await AuthenticateAsSeedUserAsync();
        var topVolunteer = await CreateVolunteerAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", firstName: "Anna", lastName: "Bianchi");
        var secondVolunteer = await CreateVolunteerAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", firstName: "Mario", lastName: "Rossi");

        var firstEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: Utc(2026, 9, 8, 8), durationHours: 5));
        var secondEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: Utc(2026, 9, 9, 8), durationHours: 3));

        await InsertParticipationAsync(firstEvent.Id, topVolunteer.User.Id, EventParticipationStatus.Partecipa);
        await InsertParticipationAsync(secondEvent.Id, topVolunteer.User.Id, EventParticipationStatus.Partecipa);
        await InsertParticipationAsync(firstEvent.Id, secondVolunteer.User.Id, EventParticipationStatus.Partecipa);

        await UpdateEventStatusAsync(firstEvent.Id, firstEvent.Name, Utc(2026, 9, 8, 8), 5, EventStatus.Concluded);
        await UpdateEventStatusAsync(secondEvent.Id, secondEvent.Name, Utc(2026, 9, 9, 8), 3, EventStatus.Concluded);

        await AuthenticateAsAsync(secondVolunteer.Email, secondVolunteer.Password);
        var response = await _client.GetAsync("/api/v1/reports/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = await response.Content.ReadFromJsonAsync<VolunteerReportingResponse>();
        Assert.NotNull(report);
        Assert.Equal(5m, report!.TotalHours);
        Assert.Equal(1, report.ParticipatedEventsCount);
        Assert.Equal(2, report.Rank);
        Assert.True(report.TotalVolunteers >= 2);
    }

    [Fact]
    public async Task Reports_EnforceRoleSpecificAccess()
    {
        await AuthenticateAsSeedUserAsync();
        var volunteer = await CreateVolunteerAsync($"vol-{Guid.NewGuid():N}@volontiamo.local");

        await AuthenticateAsAsync(volunteer.Email, volunteer.Password);
        var summaryResponse = await _client.GetAsync("/api/v1/reports/summary");

        await AuthenticateAsSeedUserAsync();
        var meResponse = await _client.GetAsync("/api/v1/reports/me");

        Assert.Equal(HttpStatusCode.Forbidden, summaryResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, meResponse.StatusCode);
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

    private async Task UpdateEventStatusAsync(int eventId, string name, DateTime startAtUtc, int durationHours, EventStatus status)
    {
        var request = new UpdateEventRequest(
            Name: name,
            StartAtUtc: startAtUtc,
            EndAtUtc: startAtUtc.AddHours(durationHours),
            Location: "Sede LILT",
            OperationalNotesMarkdown: "## Operativo\n- Accoglienza\n- Materiali",
            Status: status);

        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventId}", request);
        response.EnsureSuccessStatusCode();
    }

    private async Task InsertParticipationAsync(int eventId, Guid userId, EventParticipationStatus status)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.EventParticipations.Add(EventParticipation.Create(eventId, userId, status, DateTime.UtcNow));
        await db.SaveChangesAsync();
    }

    private async Task<UserCredentials> CreateVolunteerAsync(string email, string firstName = "Vol", string lastName = "Tester")
        => await CreateUserAsync(email, UserType.Volontario, firstName, lastName);

    private async Task<UserCredentials> CreateUserAsync(
        string email,
        UserType userType,
        string firstName = "Vol",
        string lastName = "Tester")
    {
        const string password = "Volontiamo123!";
        var request = new CreateUserRequest(
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            InitialPassword: password,
            Phone: "+390200000000",
            DateOfBirth: null,
            EnrollmentDate: DateOnly.FromDateTime(DateTime.UtcNow),
            EndDate: null,
            IsActive: true,
            UserType: userType,
            Occupation: userType == UserType.Volontario ? "Volontario" : "Operatore LILT");

        var response = await _client.PostAsJsonAsync("/api/v1/users", request);
        response.EnsureSuccessStatusCode();
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        return new UserCredentials(user!, password);
    }

    private static CreateEventRequest ValidCreateRequest(
        string? name = null,
        EventStatus status = EventStatus.Draft,
        DateTime? startAtUtc = null,
        int durationHours = 4)
    {
        var start = startAtUtc ?? Utc(2026, 8, 1, 8);
        return new CreateEventRequest(
            Name: name ?? $"Giornata prevenzione {Guid.NewGuid():N}",
            StartAtUtc: start,
            EndAtUtc: start.AddHours(durationHours),
            Location: "Sede LILT",
            OperationalNotesMarkdown: "## Operativo\n- Accoglienza\n- Materiali",
            Status: status);
    }

    private static DateTime Utc(int year, int month, int day, int hour)
        => new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    private sealed record UserCredentials(UserResponse User, string Password)
    {
        public string Email => User.Email;
    }
}
