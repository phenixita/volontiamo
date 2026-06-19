using System.Net;
using System.Net.Http.Json;
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

    [Fact]
    public async Task Create_ValidEvent_ReturnsCreatedWithNumericId()
    {
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

    private async Task<EventResponse> CreateEventAsync(CreateEventRequest request)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/events", request);
        response.EnsureSuccessStatusCode();
        var eventItem = await response.Content.ReadFromJsonAsync<EventResponse>();
        return eventItem!;
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