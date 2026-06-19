using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using volontiamo.api.Auth;
using volontiamo.api.Events;
using volontiamo.domain;

namespace volontiamo.api.tests.L1;

public class EventsEndpointTests : IClassFixture<PostgresWebApplicationFactory>
{
    private readonly HttpClient _client;

    public EventsEndpointTests(PostgresWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private async Task AuthenticateAsSeedUserAsync()
    {
        await AuthenticateAsAsync(PostgresWebApplicationFactory.SeedEmail, PostgresWebApplicationFactory.SeedPassword);
    }

    private async Task AuthenticateAsAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new AuthenticateUserRequest(
            email,
            password));
        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login!.AccessToken);
    }

    [Fact]
    public async Task Events_WithoutBearerToken_ReturnsUnauthorized()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var response = await _client.GetAsync("/api/v1/events");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MyEvents_WithoutBearerToken_ReturnsUnauthorized()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var response = await _client.GetAsync("/api/v1/events/my");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_ValidEvent_ReturnsCreatedWithNumericId()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest();

        var response = await _client.PostAsJsonAsync("/api/v1/events", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var eventItem = await response.Content.ReadFromJsonAsync<EventResponse>();
        Assert.NotNull(eventItem);
        Assert.True(eventItem!.Id > 0);
        Assert.Equal(request.Name, eventItem.Name);
        Assert.Equal(request.Status, eventItem.Status);
    }

    [Fact]
    public async Task Create_InvalidDates_ReturnsValidationProblem()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest() with
        {
            StartAtUtc = Utc(2026, 8, 1, 12),
            EndAtUtc = Utc(2026, 8, 1, 10)
        };

        var response = await _client.PostAsJsonAsync("/api/v1/events", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Contains("endAtUtc", problem!.Errors.Keys);
    }

    [Fact]
    public async Task List_DefaultIncludesDraftAndActiveButExcludesConcluded()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var draft = await CreateEventAsync(ValidCreateRequest(name: $"{token} draft", status: EventStatus.Draft));
        var active = await CreateEventAsync(ValidCreateRequest(name: $"{token} active", status: EventStatus.Active));
        var concluded = await CreateEventAsync(ValidCreateRequest(name: $"{token} concluded", status: EventStatus.Concluded));

        var response = await _client.GetAsync($"/api/v1/events?name={token}&page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.NotNull(paged);
        var ids = paged!.Items.Select(e => e.Id).ToHashSet();
        Assert.Contains(draft.Id, ids);
        Assert.Contains(active.Id, ids);
        Assert.DoesNotContain(concluded.Id, ids);
    }

    [Fact]
    public async Task List_FilterByNameIsCaseInsensitive()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var expected = await CreateEventAsync(ValidCreateRequest(name: $"Prevenzione {token}", status: EventStatus.Active));
        await CreateEventAsync(ValidCreateRequest(name: $"Altro {Guid.NewGuid():N}", status: EventStatus.Active));

        var response = await _client.GetAsync($"/api/v1/events?name=PREVENZIONE%20{token.ToUpperInvariant()}&page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.NotNull(paged);
        Assert.Contains(paged!.Items, e => e.Id == expected.Id);
    }

    [Fact]
    public async Task List_StatusFilterCanIncludeConcludedOrAll()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var draft = await CreateEventAsync(ValidCreateRequest(name: $"{token} draft", status: EventStatus.Draft));
        var concluded = await CreateEventAsync(ValidCreateRequest(name: $"{token} concluded", status: EventStatus.Concluded));

        var concludedResponse = await _client.GetAsync($"/api/v1/events?name={token}&status=concluded");
        var concludedPage = await concludedResponse.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.Equal(HttpStatusCode.OK, concludedResponse.StatusCode);
        Assert.Contains(concludedPage!.Items, e => e.Id == concluded.Id);
        Assert.DoesNotContain(concludedPage.Items, e => e.Id == draft.Id);

        var allResponse = await _client.GetAsync($"/api/v1/events?name={token}&status=all");
        var allPage = await allResponse.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.Equal(HttpStatusCode.OK, allResponse.StatusCode);
        Assert.Contains(allPage!.Items, e => e.Id == draft.Id);
        Assert.Contains(allPage.Items, e => e.Id == concluded.Id);
    }

    [Fact]
    public async Task List_ReturnsPaginatedEventsOrderedByStartThenName()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var first = await CreateEventAsync(ValidCreateRequest(name: $"{token} A", startAtUtc: Utc(2026, 9, 1, 8)));
        var second = await CreateEventAsync(ValidCreateRequest(name: $"{token} B", startAtUtc: Utc(2026, 9, 2, 8)));
        await CreateEventAsync(ValidCreateRequest(name: $"{token} C", startAtUtc: Utc(2026, 9, 3, 8)));

        var firstPageResponse = await _client.GetAsync($"/api/v1/events?name={token}&page=1&pageSize=1&status=all");
        var secondPageResponse = await _client.GetAsync($"/api/v1/events?name={token}&page=2&pageSize=1&status=all");

        Assert.Equal(HttpStatusCode.OK, firstPageResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondPageResponse.StatusCode);
        var firstPage = await firstPageResponse.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        var secondPage = await secondPageResponse.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.Equal(3, firstPage!.TotalCount);
        Assert.Equal(first.Id, firstPage.Items.Single().Id);
        Assert.Equal(second.Id, secondPage!.Items.Single().Id);
    }

    [Fact]
    public async Task Delete_ExistingEvent_ReturnsNoContentAndExcludesFromList()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} cancellazione", status: EventStatus.Active));

        var deleteResponse = await _client.DeleteAsync($"/api/v1/events/{eventItem.Id}");
        var listResponse = await _client.GetAsync($"/api/v1/events?name={token}&status=all");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var paged = await listResponse.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.NotNull(paged);
        Assert.DoesNotContain(paged!.Items, e => e.Id == eventItem.Id);
    }

    [Fact]
    public async Task List_IncludesAcceptedParticipantsCountAndIgnoresRefused()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} aggregati", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Accepted);

        var secondUserEmail = $"vol-{Guid.NewGuid():N}@volontiamo.local";
        const string secondUserPassword = "Volontiamo123!";
        await CreateUserAsync(secondUserEmail, secondUserPassword);

        await AuthenticateAsAsync(secondUserEmail, secondUserPassword);
        await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Refused);

        await AuthenticateAsSeedUserAsync();
        var response = await _client.GetAsync($"/api/v1/events?name={token}&status=active&page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.NotNull(paged);
        var listed = Assert.Single(paged!.Items);
        Assert.Equal(eventItem.Id, listed.Id);
        Assert.Equal(1, listed.AcceptedParticipantsCount);
    }

    [Fact]
    public async Task GetDetail_ReturnsEventAndAcceptedParticipantsOnly()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} dettaglio", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Accepted);

        var secondUserEmail = $"vol-{Guid.NewGuid():N}@volontiamo.local";
        const string secondUserPassword = "Volontiamo123!";
        await CreateUserAsync(secondUserEmail, secondUserPassword);

        await AuthenticateAsAsync(secondUserEmail, secondUserPassword);
        await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Refused);

        await AuthenticateAsSeedUserAsync();
        var response = await _client.GetAsync($"/api/v1/events/{eventItem.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await response.Content.ReadFromJsonAsync<EventDetailResponse>();
        Assert.NotNull(detail);
        Assert.Equal(eventItem.Id, detail!.Id);
        Assert.Equal(1, detail.AcceptedParticipantsCount);
        var participant = Assert.Single(detail.AcceptedParticipants);
        Assert.Equal(PostgresWebApplicationFactory.SeedEmail, participant.Email);
    }

    [Fact]
    public async Task GetDetail_WhenEventDoesNotExist_ReturnsNotFound()
    {
        await AuthenticateAsSeedUserAsync();

        var response = await _client.GetAsync("/api/v1/events/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MyEvents_DefaultAvailableReturnsActiveFutureEventsAndHidesRefused()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var available = await CreateEventAsync(ValidCreateRequest(name: $"{token} available", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var refused = await CreateEventAsync(ValidCreateRequest(name: $"{token} refused", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(11)));
        await CreateEventAsync(ValidCreateRequest(name: $"{token} draft", status: EventStatus.Draft, startAtUtc: DateTime.UtcNow.AddDays(12)));
        await CreateEventAsync(ValidCreateRequest(name: $"{token} concluded", status: EventStatus.Concluded, startAtUtc: DateTime.UtcNow.AddDays(13)));
        await CreateEventAsync(ValidCreateRequest(name: $"{token} started", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddHours(-2)));
        await SetParticipationAsync(refused.Id, EventParticipationStatus.Refused);

        var response = await _client.GetAsync($"/api/v1/events/my?page=1&pageSize=100");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<ParticipantEventResponse>>();
        Assert.NotNull(paged);
        var matching = paged!.Items.Where(e => e.Name.Contains(token, StringComparison.Ordinal)).ToList();
        Assert.Single(matching);
        Assert.Equal(available.Id, matching[0].Id);
        Assert.Null(matching[0].ParticipationStatus);
    }

    [Fact]
    public async Task MyEvents_RefusedViewReturnsOnlyRefusedActiveFutureEvents()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var refused = await CreateEventAsync(ValidCreateRequest(name: $"{token} refused", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var accepted = await CreateEventAsync(ValidCreateRequest(name: $"{token} accepted", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(11)));
        await SetParticipationAsync(refused.Id, EventParticipationStatus.Refused);
        await SetParticipationAsync(accepted.Id, EventParticipationStatus.Accepted);

        var response = await _client.GetAsync("/api/v1/events/my?view=refused&page=1&pageSize=100");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<ParticipantEventResponse>>();
        Assert.NotNull(paged);
        var matching = paged!.Items.Where(e => e.Name.Contains(token, StringComparison.Ordinal)).ToList();
        Assert.Single(matching);
        Assert.Equal(refused.Id, matching[0].Id);
        Assert.Equal(EventParticipationStatus.Refused, matching[0].ParticipationStatus);
    }

    [Fact]
    public async Task Participation_PutCreatesAndUpdatesStatus()
    {
        await AuthenticateAsSeedUserAsync();
        var eventItem = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var acceptedResponse = await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Accepted);
        var refusedResponse = await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Refused);

        Assert.Equal(EventParticipationStatus.Accepted, acceptedResponse.ParticipationStatus);
        Assert.Equal(EventParticipationStatus.Refused, refusedResponse.ParticipationStatus);
        Assert.Equal(eventItem.Id, refusedResponse.Id);
    }

    [Fact]
    public async Task Participation_WhenEventIsNotSelectable_ReturnsConflict()
    {
        await AuthenticateAsSeedUserAsync();
        var draft = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Draft, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var concluded = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Concluded, startAtUtc: DateTime.UtcNow.AddDays(11)));
        var alreadyStarted = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddHours(-2)));

        var draftResponse = await _client.PutAsJsonAsync($"/api/v1/events/{draft.Id}/participation", new { status = "Accepted" });
        var concludedResponse = await _client.PutAsJsonAsync($"/api/v1/events/{concluded.Id}/participation", new { status = "Accepted" });
        var alreadyStartedResponse = await _client.PutAsJsonAsync($"/api/v1/events/{alreadyStarted.Id}/participation", new { status = "Accepted" });

        Assert.Equal(HttpStatusCode.Conflict, draftResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, concludedResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, alreadyStartedResponse.StatusCode);
    }

    [Fact]
    public async Task List_BackofficeBehaviorIsUnchangedWhenParticipationIsRefused()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} backoffice", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Refused);

        var response = await _client.GetAsync($"/api/v1/events?name={token}&status=active");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.NotNull(paged);
        Assert.Contains(paged!.Items, e => e.Id == eventItem.Id);
    }

    [Fact]
    public async Task Update_ExistingEvent_ReturnsNoContentAndPersistsChanges()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} originale", status: EventStatus.Draft, startAtUtc: Utc(2026, 8, 1, 8)));

        var updateRequest = new UpdateEventRequest(
            Name: $"{token} aggiornato",
            StartAtUtc: Utc(2026, 9, 1, 9),
            EndAtUtc: Utc(2026, 9, 1, 13),
            Location: "Nuova sede",
            OperationalNotesMarkdown: "## Aggiornato",
            Status: EventStatus.Active);

        var updateResponse = await _client.PutAsJsonAsync($"/api/v1/events/{eventItem.Id}", updateRequest);
        var detailResponse = await _client.GetAsync($"/api/v1/events/{eventItem.Id}");

        Assert.Equal(HttpStatusCode.NoContent, updateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        var detail = await detailResponse.Content.ReadFromJsonAsync<EventDetailResponse>();
        Assert.NotNull(detail);
        Assert.Equal($"{token} aggiornato", detail!.Name);
        Assert.Equal("Nuova sede", detail.Location);
        Assert.Equal(EventStatus.Active, detail.Status);
        Assert.Equal(Utc(2026, 9, 1, 9), detail.StartAtUtc);
    }

    [Fact]
    public async Task Update_WhenEventDoesNotExist_ReturnsNotFound()
    {
        await AuthenticateAsSeedUserAsync();
        var updateRequest = new UpdateEventRequest(
            Name: "Inesistente",
            StartAtUtc: Utc(2026, 9, 1, 9),
            EndAtUtc: Utc(2026, 9, 1, 13),
            Location: "Sede",
            OperationalNotesMarkdown: "Note",
            Status: EventStatus.Active);

        var response = await _client.PutAsJsonAsync("/api/v1/events/999999", updateRequest);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_WithInvalidDates_ReturnsValidationProblem()
    {
        await AuthenticateAsSeedUserAsync();
        var eventItem = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Draft));

        var updateRequest = new UpdateEventRequest(
            Name: "Aggiornato",
            StartAtUtc: Utc(2026, 9, 1, 12),
            EndAtUtc: Utc(2026, 9, 1, 10),
            Location: "Sede",
            OperationalNotesMarkdown: "Note",
            Status: EventStatus.Active);

        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventItem.Id}", updateRequest);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Contains("endAtUtc", problem!.Errors.Keys);
    }

    [Fact]
    public async Task RemoveParticipant_WhenAccepted_ReturnsNoContentAndExcludesFromDetail()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} rimozione", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var volunteerEmail = $"vol-{Guid.NewGuid():N}@volontiamo.local";
        const string volunteerPassword = "Volontiamo123!";
        var volunteer = await CreateUserAsync(volunteerEmail, volunteerPassword);

        await AuthenticateAsAsync(volunteerEmail, volunteerPassword);
        await SetParticipationAsync(eventItem.Id, EventParticipationStatus.Accepted);

        await AuthenticateAsSeedUserAsync();
        var removeResponse = await _client.DeleteAsync($"/api/v1/events/{eventItem.Id}/participants/{volunteer.Id}");
        var detailResponse = await _client.GetAsync($"/api/v1/events/{eventItem.Id}");

        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        var detail = await detailResponse.Content.ReadFromJsonAsync<EventDetailResponse>();
        Assert.NotNull(detail);
        Assert.Equal(0, detail!.AcceptedParticipantsCount);
        Assert.DoesNotContain(detail.AcceptedParticipants, p => p.UserId == volunteer.Id);
    }

    [Fact]
    public async Task RemoveParticipant_WhenNotAccepted_ReturnsNotFound()
    {
        await AuthenticateAsSeedUserAsync();
        var eventItem = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var response = await _client.DeleteAsync($"/api/v1/events/{eventItem.Id}/participants/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<EventResponse> CreateEventAsync(CreateEventRequest request)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/events", request);
        response.EnsureSuccessStatusCode();
        var eventItem = await response.Content.ReadFromJsonAsync<EventResponse>();
        return eventItem!;
    }

    private async Task<UserResponse> CreateUserAsync(string email, string password)
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
            IsActive: true,
            UserType: UserType.Volontario,
            Occupation: "Volontario");

        var response = await _client.PostAsJsonAsync("/api/v1/users", request);
        response.EnsureSuccessStatusCode();
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        return user!;
    }

    private async Task<ParticipantEventResponse> SetParticipationAsync(int eventId, EventParticipationStatus status)
    {
        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventId}/participation", new { status = status.ToString() });
        response.EnsureSuccessStatusCode();
        var participantEvent = await response.Content.ReadFromJsonAsync<ParticipantEventResponse>();
        return participantEvent!;
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
}