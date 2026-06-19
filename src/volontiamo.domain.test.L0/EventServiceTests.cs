using volontiamo.domain;

namespace volontiamo.domain.test.L0;

public class EventServiceTests
{
    [Fact]
    public async Task CreateAsync_WhenNameIsMissing_ReturnsValidationError()
    {
        var repository = new FakeEventRepository();
        var service = new EventService(repository);
        var request = ValidCreateRequest() with { Name = "" };

        var result = await service.CreateAsync(request);

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "name");
        Assert.Equal(0, repository.AddCallCount);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WhenDatesAreNotUtc_ReturnsValidationError()
    {
        var repository = new FakeEventRepository();
        var service = new EventService(repository);
        var request = ValidCreateRequest() with
        {
            StartAtUtc = new DateTime(2026, 7, 1, 8, 0, 0, DateTimeKind.Unspecified)
        };

        var result = await service.CreateAsync(request);

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "startAtUtc");
    }

    [Fact]
    public async Task CreateAsync_WhenEndIsBeforeStart_ReturnsValidationError()
    {
        var repository = new FakeEventRepository();
        var service = new EventService(repository);
        var request = ValidCreateRequest() with
        {
            StartAtUtc = Utc(2026, 7, 1, 10),
            EndAtUtc = Utc(2026, 7, 1, 9)
        };

        var result = await service.CreateAsync(request);

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "endAtUtc");
    }

    [Fact]
    public async Task CreateAsync_WhenRequestIsValid_PersistsEventAndReturnsMappedResponse()
    {
        var repository = new FakeEventRepository();
        var service = new EventService(repository);
        var notes = string.Join('\n', Enumerable.Repeat("- Preparare banchetto", 200));
        var request = ValidCreateRequest(location: "  ", notes: notes);

        var result = await service.CreateAsync(request);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal("Giornata prevenzione", result.Value!.Name);
        Assert.Null(result.Value.Location);
        Assert.Equal(notes, result.Value.OperationalNotesMarkdown);
        Assert.Equal(EventStatus.Draft, result.Value.Status);
        Assert.Equal(1, repository.AddCallCount);
        Assert.Equal(1, repository.SaveChangesCallCount);
        Assert.NotNull(repository.LastAddedEvent);
    }

    [Fact]
    public async Task ListAsync_WhenStatusesAreMissing_UsesDraftAndActiveDefaults()
    {
        var repository = new FakeEventRepository { ListResult = new PagedResult<Event>([], 0) };
        var service = new EventService(repository);

        await service.ListAsync(new EventListRequest(Name: null, Statuses: null, Page: 1, PageSize: 10));

        Assert.Equal(new HashSet<EventStatus> { EventStatus.Draft, EventStatus.Active }, repository.LastListFilter!.Statuses);
    }

    [Fact]
    public async Task ListAsync_DelegatesTrimmedNameAndExplicitStatusesToRepository()
    {
        var repository = new FakeEventRepository();
        var service = new EventService(repository);
        var statuses = new HashSet<EventStatus> { EventStatus.Concluded };

        await service.ListAsync(new EventListRequest("  prevenzione  ", statuses, Page: 1, PageSize: 10));

        Assert.Equal("prevenzione", repository.LastListFilter!.Name);
        Assert.Same(statuses, repository.LastListFilter.Statuses);
    }

    [Fact]
    public async Task ListAsync_NormalizesPaginationAndMapsItems()
    {
        var eventItem = CreateEvent("Screening", EventStatus.Active);
        var repository = new FakeEventRepository
        {
            ListHandler = (_, _, _) => new PagedResult<Event>([eventItem], 1)
        };
        var service = new EventService(repository);

        var result = await service.ListAsync(new EventListRequest(null, null, Page: 0, PageSize: 999));

        Assert.Equal(1, repository.LastListPage);
        Assert.Equal(100, repository.LastListPageSize);
        Assert.Equal(1, result.Page);
        Assert.Equal(100, result.PageSize);
        Assert.Single(result.Items);
        Assert.Equal("Screening", result.Items[0].Name);
    }

    [Fact]
    public async Task DeleteAsync_WhenEventDoesNotExist_ReturnsNotFound()
    {
        var repository = new FakeEventRepository();
        var service = new EventService(repository);

        var result = await service.DeleteAsync(999);

        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task DeleteAsync_WhenEventExists_SoftDeletesAndSaves()
    {
        var existing = CreateEvent("Festa", EventStatus.Active);
        var repository = new FakeEventRepository { GetByIdResult = existing };
        var service = new EventService(repository);

        var result = await service.DeleteAsync(1);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.True(result.Value);
        Assert.True(existing.IsDeleted);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    private static CreateEventRequest ValidCreateRequest(
        string name = "Giornata prevenzione",
        string? location = "Sede LILT",
        string? notes = "## Operativo\n- Accoglienza volontari")
    {
        return new CreateEventRequest(
            Name: name,
            StartAtUtc: Utc(2026, 7, 1, 8),
            EndAtUtc: Utc(2026, 7, 1, 12),
            Location: location,
            OperationalNotesMarkdown: notes,
            Status: EventStatus.Draft);
    }

    private static Event CreateEvent(string name, EventStatus status)
    {
        return Event.Create(
            name,
            Utc(2026, 7, 1, 8),
            Utc(2026, 7, 1, 12),
            "Sede LILT",
            "Note",
            status);
    }

    private static DateTime Utc(int year, int month, int day, int hour)
        => new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    private sealed class FakeEventRepository : IEventRepository
    {
        public Event? GetByIdResult { get; set; }
        public PagedResult<Event> ListResult { get; set; } = new([], 0);

        public Func<int, Event?>? GetByIdHandler { get; set; }
        public Func<EventListFilter, int, int, PagedResult<Event>>? ListHandler { get; set; }

        public EventListFilter? LastListFilter { get; private set; }
        public int LastListPage { get; private set; }
        public int LastListPageSize { get; private set; }
        public Event? LastAddedEvent { get; private set; }
        public int AddCallCount { get; private set; }
        public int SaveChangesCallCount { get; private set; }

        public Task<Event?> GetByIdAsync(int id, CancellationToken ct = default)
        {
            var eventItem = GetByIdHandler is null ? GetByIdResult : GetByIdHandler(id);
            return Task.FromResult(eventItem);
        }

        public Task<PagedResult<Event>> ListAsync(EventListFilter filter, int page, int pageSize, CancellationToken ct = default)
        {
            LastListFilter = filter;
            LastListPage = page;
            LastListPageSize = pageSize;
            var result = ListHandler is null ? ListResult : ListHandler(filter, page, pageSize);
            return Task.FromResult(result);
        }

        public Task AddAsync(Event eventItem, CancellationToken ct = default)
        {
            LastAddedEvent = eventItem;
            AddCallCount++;
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken ct = default)
        {
            SaveChangesCallCount++;
            return Task.CompletedTask;
        }
    }
}