using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using volontiamo.api.Auth;
using volontiamo.api.Events;
using volontiamo.api.Persistence;
using volontiamo.api.Users;
using volontiamo.domain;

namespace volontiamo.api.tests.L1;

public class EventsEndpointTests : IClassFixture<PostgresWebApplicationFactory>
{
    private readonly PostgresWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public EventsEndpointTests(PostgresWebApplicationFactory factory)
    {
        _factory = factory;
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
    public async Task List_IncludesCandidataAndPartecipaCountsAndIgnoresOtherStatuses()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} aggregati", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var candidataVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        var partecipaVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        var rifiutataVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        var nonInteressataVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);

        await InsertParticipationAsync(eventItem.Id, candidataVolunteer.Id, EventParticipationStatus.Candidata);
        await InsertParticipationAsync(eventItem.Id, partecipaVolunteer.Id, EventParticipationStatus.Partecipa);
        await InsertParticipationAsync(eventItem.Id, rifiutataVolunteer.Id, EventParticipationStatus.Rifiutata);
        await InsertParticipationAsync(eventItem.Id, nonInteressataVolunteer.Id, EventParticipationStatus.NonInteressata);

        await AuthenticateAsSeedUserAsync();
        var response = await _client.GetAsync($"/api/v1/events?name={token}&status=active&page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        Assert.NotNull(paged);
        var listed = Assert.Single(paged!.Items);
        Assert.Equal(eventItem.Id, listed.Id);
        Assert.Equal(1, listed.CandidataParticipantsCount);
        Assert.Equal(1, listed.PartecipaParticipantsCount);
    }

    [Fact]
    public async Task GetDetail_ReturnsParticipantsSeparatedByStatus()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} dettaglio", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var candidataVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        var partecipaVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        var nonInteressataVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        var rifiutataVolunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);

        await InsertParticipationAsync(eventItem.Id, candidataVolunteer.Id, EventParticipationStatus.Candidata);
        await InsertParticipationAsync(eventItem.Id, partecipaVolunteer.Id, EventParticipationStatus.Partecipa);
        await InsertParticipationAsync(eventItem.Id, nonInteressataVolunteer.Id, EventParticipationStatus.NonInteressata);
        await InsertParticipationAsync(eventItem.Id, rifiutataVolunteer.Id, EventParticipationStatus.Rifiutata);

        await AuthenticateAsSeedUserAsync();
        var response = await _client.GetAsync($"/api/v1/events/{eventItem.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await response.Content.ReadFromJsonAsync<EventDetailResponse>();
        Assert.NotNull(detail);
        Assert.Equal(eventItem.Id, detail!.Id);
        Assert.Equal(candidataVolunteer.Email, Assert.Single(detail.CandidataParticipants).Email);
        Assert.Equal(partecipaVolunteer.Email, Assert.Single(detail.PartecipaParticipants).Email);
        Assert.Equal(nonInteressataVolunteer.Email, Assert.Single(detail.NonInteressataParticipants).Email);
        Assert.Equal(rifiutataVolunteer.Email, Assert.Single(detail.RifiutataParticipants).Email);
    }

    [Fact]
    public async Task ListAndDetail_ExcludePartecipaLiltParticipantsFromLegacyDirtyData()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} dirty", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        var liltUser = await CreateUserCredentialsAsync($"lilt-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Lilt);

        await InsertParticipationAsync(eventItem.Id, volunteer.User.Id, EventParticipationStatus.Partecipa);

        await InsertParticipationAsync(eventItem.Id, liltUser.User.Id, EventParticipationStatus.Partecipa);

        await AuthenticateAsSeedUserAsync();
        var listResponse = await _client.GetAsync($"/api/v1/events?name={token}&status=active&page=1&pageSize=10");
        var detailResponse = await _client.GetAsync($"/api/v1/events/{eventItem.Id}");

        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);

        var paged = await listResponse.Content.ReadFromJsonAsync<PagedResponse<EventResponse>>();
        var detail = await detailResponse.Content.ReadFromJsonAsync<EventDetailResponse>();

        Assert.NotNull(paged);
        Assert.NotNull(detail);

        var listed = Assert.Single(paged!.Items);
        Assert.Equal(0, listed.CandidataParticipantsCount);
        Assert.Equal(1, listed.PartecipaParticipantsCount);
        var participant = Assert.Single(detail!.PartecipaParticipants);
        Assert.Equal(volunteer.User.Id, participant.UserId);
        Assert.DoesNotContain(detail.PartecipaParticipants, item => item.UserId == liltUser.User.Id);
    }

    [Fact]
    public async Task GetDetail_WhenEventDoesNotExist_ReturnsNotFound()
    {
        await AuthenticateAsSeedUserAsync();

        var response = await _client.GetAsync("/api/v1/events/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MyEvents_DefaultAvailableReturnsActiveFutureEventsAndHidesNonInteressata()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var available = await CreateEventAsync(ValidCreateRequest(name: $"{token} available", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var nonInteressata = await CreateEventAsync(ValidCreateRequest(name: $"{token} noninteressata", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(11)));
        await CreateEventAsync(ValidCreateRequest(name: $"{token} draft", status: EventStatus.Draft, startAtUtc: DateTime.UtcNow.AddDays(12)));
        await CreateEventAsync(ValidCreateRequest(name: $"{token} concluded", status: EventStatus.Concluded, startAtUtc: DateTime.UtcNow.AddDays(13)));
        await CreateEventAsync(ValidCreateRequest(name: $"{token} started", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddHours(-2)));

        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        await InsertParticipationAsync(nonInteressata.Id, volunteer.Id, EventParticipationStatus.NonInteressata);

        await AuthenticateAsAsync(volunteer.Email, volunteer.Password);

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
    public async Task MyEvents_NonInteressataViewReturnsOnlyNonInteressataActiveFutureEvents()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var nonInteressata = await CreateEventAsync(ValidCreateRequest(name: $"{token} noninteressata", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var candidata = await CreateEventAsync(ValidCreateRequest(name: $"{token} candidata", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(11)));

        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        await InsertParticipationAsync(nonInteressata.Id, volunteer.Id, EventParticipationStatus.NonInteressata);
        await InsertParticipationAsync(candidata.Id, volunteer.Id, EventParticipationStatus.Candidata);

        await AuthenticateAsAsync(volunteer.Email, volunteer.Password);

        var response = await _client.GetAsync("/api/v1/events/my?view=non-interessata&page=1&pageSize=100");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<ParticipantEventResponse>>();
        Assert.NotNull(paged);
        var matching = paged!.Items.Where(e => e.Name.Contains(token, StringComparison.Ordinal)).ToList();
        Assert.Single(matching);
        Assert.Equal(nonInteressata.Id, matching[0].Id);
        Assert.Equal(EventParticipationStatus.NonInteressata, matching[0].ParticipationStatus);
    }

    [Fact]
    public async Task VolunteerParticipationEndpoints_CreateCandidataNonInteressataAndRestoreAvailability()
    {
        await AuthenticateAsSeedUserAsync();
        var candidaturaEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var nonInteressataEvent = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(11)));

        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        await AuthenticateAsAsync(volunteer.Email, volunteer.Password);

        var candidataResponse = await ApplyToEventAsync(candidaturaEvent.Id);
        var nonInteressataResponse = await MarkAsNotInterestedAsync(nonInteressataEvent.Id);
        var restoredResponse = await RestoreAvailabilityAsync(nonInteressataEvent.Id);

        Assert.Equal(EventParticipationStatus.Candidata, candidataResponse.ParticipationStatus);
        Assert.Equal(EventParticipationStatus.NonInteressata, nonInteressataResponse.ParticipationStatus);
        Assert.Equal(nonInteressataEvent.Id, restoredResponse.Id);
        Assert.Null(restoredResponse.ParticipationStatus);
    }

    [Fact]
    public async Task VolunteerParticipationEndpoints_WhenEventIsNotSelectable_ReturnConflict()
    {
        await AuthenticateAsSeedUserAsync();
        var draft = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Draft, startAtUtc: DateTime.UtcNow.AddDays(10)));
        var concluded = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Concluded, startAtUtc: DateTime.UtcNow.AddDays(11)));
        var alreadyStarted = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddHours(-2)));

        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        await AuthenticateAsAsync(volunteer.Email, volunteer.Password);

    var draftResponse = await _client.PutAsJsonAsync($"/api/v1/events/{draft.Id}/participation/candidata", new { });
    var concludedResponse = await _client.PutAsJsonAsync($"/api/v1/events/{concluded.Id}/participation/candidata", new { });
    var alreadyStartedResponse = await _client.PutAsJsonAsync($"/api/v1/events/{alreadyStarted.Id}/participation/non-interessata", new { });

        Assert.Equal(HttpStatusCode.Conflict, draftResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, concludedResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, alreadyStartedResponse.StatusCode);
    }

    [Fact]
    public async Task List_BackofficeBehaviorIsUnchangedWhenParticipationIsRifiutata()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} backoffice", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var volunteer = await CreateUserCredentialsAsync($"vol-{Guid.NewGuid():N}@volontiamo.local", "Volontiamo123!", UserType.Volontario);
        await InsertParticipationAsync(eventItem.Id, volunteer.Id, EventParticipationStatus.Rifiutata);

        await AuthenticateAsSeedUserAsync();
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
    public async Task AcceptCandidate_WhenCandidata_ReturnsNoContentAndMovesParticipantToPartecipa()
    {
        await AuthenticateAsSeedUserAsync();
        var token = Guid.NewGuid().ToString("N");
        var eventItem = await CreateEventAsync(ValidCreateRequest(name: $"{token} rimozione", status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var volunteerEmail = $"vol-{Guid.NewGuid():N}@volontiamo.local";
        const string volunteerPassword = "Volontiamo123!";
        var volunteer = await CreateUserAsync(volunteerEmail, volunteerPassword);

        await InsertParticipationAsync(eventItem.Id, volunteer.Id, EventParticipationStatus.Candidata);

        await AuthenticateAsSeedUserAsync();
        var removeResponse = await AcceptCandidateAsync(eventItem.Id, volunteer.Id);
        var detailResponse = await _client.GetAsync($"/api/v1/events/{eventItem.Id}");

        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        var detail = await detailResponse.Content.ReadFromJsonAsync<EventDetailResponse>();
        Assert.NotNull(detail);
        Assert.Empty(detail!.CandidataParticipants);
        Assert.Contains(detail.PartecipaParticipants, p => p.UserId == volunteer.Id);
    }

    [Fact]
    public async Task MyEvents_ForLiltUser_ReturnsForbidden()
    {
        await AuthenticateAsSeedUserAsync();

        var response = await _client.GetAsync("/api/v1/events/my?page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Participation_ForLiltUser_ReturnsForbidden()
    {
        await AuthenticateAsSeedUserAsync();
        var eventItem = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventItem.Id}/participation/candidata", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RejectCandidate_WhenParticipationIsMissing_ReturnsConflict()
    {
        await AuthenticateAsSeedUserAsync();
        var eventItem = await CreateEventAsync(ValidCreateRequest(status: EventStatus.Active, startAtUtc: DateTime.UtcNow.AddDays(10)));

        var response = await RejectCandidateAsync(eventItem.Id, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    private async Task<EventResponse> CreateEventAsync(CreateEventRequest request)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/events", request);
        response.EnsureSuccessStatusCode();
        var eventItem = await response.Content.ReadFromJsonAsync<EventResponse>();
        return eventItem!;
    }

    private async Task<UserResponse> CreateUserAsync(string email, string password, UserType userType = UserType.Volontario)
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
            UserType: userType,
            Occupation: userType == UserType.Volontario ? "Volontario" : "Operatore LILT");

        var response = await _client.PostAsJsonAsync("/api/v1/users", request);
        response.EnsureSuccessStatusCode();
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        return user!;
    }

    private async Task<TestUserCredentials> CreateUserCredentialsAsync(string email, string password, UserType userType = UserType.Volontario)
    {
        var user = await CreateUserAsync(email, password, userType);
        return new TestUserCredentials(user, password);
    }

    private async Task InsertParticipationAsync(int eventId, Guid userId, EventParticipationStatus status)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.EventParticipations.Add(EventParticipation.Create(eventId, userId, status, DateTime.UtcNow));
        await db.SaveChangesAsync();
    }

    private async Task<ParticipantEventResponse> ApplyToEventAsync(int eventId)
    {
        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventId}/participation/candidata", new { });
        response.EnsureSuccessStatusCode();
        var participantEvent = await response.Content.ReadFromJsonAsync<ParticipantEventResponse>();
        return participantEvent!;
    }

    private async Task<ParticipantEventResponse> MarkAsNotInterestedAsync(int eventId)
    {
        var response = await _client.PutAsJsonAsync($"/api/v1/events/{eventId}/participation/non-interessata", new { });
        response.EnsureSuccessStatusCode();
        var participantEvent = await response.Content.ReadFromJsonAsync<ParticipantEventResponse>();
        return participantEvent!;
    }

    private async Task<ParticipantEventResponse> RestoreAvailabilityAsync(int eventId)
    {
        var response = await _client.DeleteAsync($"/api/v1/events/{eventId}/participation/non-interessata");
        response.EnsureSuccessStatusCode();
        var participantEvent = await response.Content.ReadFromJsonAsync<ParticipantEventResponse>();
        return participantEvent!;
    }

    private Task<HttpResponseMessage> AcceptCandidateAsync(int eventId, Guid userId)
        => _client.PutAsJsonAsync($"/api/v1/events/{eventId}/candidates/{userId}/accept", new { });

    private Task<HttpResponseMessage> RejectCandidateAsync(int eventId, Guid userId)
        => _client.PutAsJsonAsync($"/api/v1/events/{eventId}/candidates/{userId}/reject", new { });

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
        public Guid Id => User.Id;
        public string Email => User.Email;
    }
}