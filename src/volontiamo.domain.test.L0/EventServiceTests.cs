using volontiamo.domain;

namespace volontiamo.domain.test.L0;

public class EventServiceTests
{
    private static readonly DateTime FixedNowUtc = Utc(2026, 6, 19, 12);

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

    [Fact]
    public async Task ListParticipantEventsAsync_AvailableIncludesActiveFutureUnselectedAndAcceptedEvents()
    {
        var userId = Guid.NewGuid();
        var unselected = CreateEvent(id: 1, name: "Unselected", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var accepted = CreateEvent(id: 2, name: "Accepted", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(2));
        var refused = CreateEvent(id: 3, name: "Refused", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(3));
        var repository = new FakeEventRepository
        {
            Events = [unselected, accepted, refused],
            Participations =
            [
                EventParticipation.Create(accepted.Id, userId, EventParticipationStatus.Accepted, FixedNowUtc),
                EventParticipation.Create(refused.Id, userId, EventParticipationStatus.Refused, FixedNowUtc)
            ]
        };
        var service = CreateService(repository);

        var result = await service.ListParticipantEventsAsync(new ParticipantEventListRequest(userId, ParticipantEventListMode.Available, 1, 10));

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(["Unselected", "Accepted"], result.Items.Select(e => e.Name).ToArray());
        Assert.Null(result.Items[0].ParticipationStatus);
        Assert.Equal(EventParticipationStatus.Accepted, result.Items[1].ParticipationStatus);
    }

    [Fact]
    public async Task ListParticipantEventsAsync_RefusedReturnsOnlyRefusedActiveFutureEvents()
    {
        var userId = Guid.NewGuid();
        var refused = CreateEvent(id: 1, name: "Refused", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var accepted = CreateEvent(id: 2, name: "Accepted", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(2));
        var repository = new FakeEventRepository
        {
            Events = [refused, accepted],
            Participations =
            [
                EventParticipation.Create(refused.Id, userId, EventParticipationStatus.Refused, FixedNowUtc),
                EventParticipation.Create(accepted.Id, userId, EventParticipationStatus.Accepted, FixedNowUtc)
            ]
        };
        var service = CreateService(repository);

        var result = await service.ListParticipantEventsAsync(new ParticipantEventListRequest(userId, ParticipantEventListMode.Refused, 1, 10));

        Assert.Single(result.Items);
        Assert.Equal("Refused", result.Items[0].Name);
        Assert.Equal(EventParticipationStatus.Refused, result.Items[0].ParticipationStatus);
    }

    [Fact]
    public async Task ListParticipantEventsAsync_ExcludesDraftConcludedDeletedAndAlreadyStartedEvents()
    {
        var userId = Guid.NewGuid();
        var activeFuture = CreateEvent(id: 1, name: "Active future", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddHours(1));
        var draft = CreateEvent(id: 2, name: "Draft", status: EventStatus.Draft, startAtUtc: FixedNowUtc.AddHours(1));
        var concluded = CreateEvent(id: 3, name: "Concluded", status: EventStatus.Concluded, startAtUtc: FixedNowUtc.AddHours(1));
        var alreadyStarted = CreateEvent(id: 4, name: "Started", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddMinutes(-1));
        var deleted = CreateEvent(id: 5, name: "Deleted", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddHours(1));
        deleted.SoftDelete();
        var repository = new FakeEventRepository { Events = [activeFuture, draft, concluded, alreadyStarted, deleted] };
        var service = CreateService(repository);

        var result = await service.ListParticipantEventsAsync(new ParticipantEventListRequest(userId, ParticipantEventListMode.Available, 1, 10));

        Assert.Single(result.Items);
        Assert.Equal("Active future", result.Items[0].Name);
    }

    [Fact]
    public async Task SetParticipationAsync_WhenFirstChoice_CreatesParticipation()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 11, name: "Selectable", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.SetParticipationAsync(eventItem.Id, new SetEventParticipationRequest(userId, EventParticipationStatus.Accepted));

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.Equal(EventParticipationStatus.Accepted, result.Value!.ParticipationStatus);
        var participation = Assert.Single(repository.Participations);
        Assert.Equal(eventItem.Id, participation.EventId);
        Assert.Equal(userId, participation.UserId);
        Assert.Equal(EventParticipationStatus.Accepted, participation.Status);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task SetParticipationAsync_WhenChangingChoice_UpdatesExistingParticipation()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 12, name: "Selectable", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var participation = EventParticipation.Create(eventItem.Id, userId, EventParticipationStatus.Accepted, FixedNowUtc.AddDays(-1));
        var repository = new FakeEventRepository { Events = [eventItem], Participations = [participation] };
        var service = CreateService(repository);

        var refused = await service.SetParticipationAsync(eventItem.Id, new SetEventParticipationRequest(userId, EventParticipationStatus.Refused));
        var accepted = await service.SetParticipationAsync(eventItem.Id, new SetEventParticipationRequest(userId, EventParticipationStatus.Accepted));

        Assert.Equal(ResultStatus.Ok, refused.Status);
        Assert.Equal(ResultStatus.Ok, accepted.Status);
        Assert.Single(repository.Participations);
        Assert.Equal(EventParticipationStatus.Accepted, participation.Status);
        Assert.Equal(2, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task SetParticipationAsync_WhenEventIsMissing_ReturnsNotFound()
    {
        var repository = new FakeEventRepository();
        var service = CreateService(repository);

        var result = await service.SetParticipationAsync(404, new SetEventParticipationRequest(Guid.NewGuid(), EventParticipationStatus.Accepted));

        Assert.Equal(ResultStatus.NotFound, result.Status);
        Assert.Empty(repository.Participations);
    }

    [Theory]
    [InlineData(EventStatus.Draft, 1, false)]
    [InlineData(EventStatus.Concluded, 1, false)]
    [InlineData(EventStatus.Active, -1, false)]
    [InlineData(EventStatus.Active, 1, true)]
    public async Task SetParticipationAsync_WhenEventIsNotSelectable_ReturnsConflict(EventStatus status, int startOffsetHours, bool deleted)
    {
        var eventItem = CreateEvent(id: 13, name: "Maybe selectable", status: status, startAtUtc: FixedNowUtc.AddHours(startOffsetHours));
        if (deleted)
            eventItem.SoftDelete();

        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.SetParticipationAsync(eventItem.Id, new SetEventParticipationRequest(Guid.NewGuid(), EventParticipationStatus.Accepted));

        Assert.Equal(ResultStatus.Conflict, result.Status);
        Assert.Empty(repository.Participations);
        Assert.Equal(0, repository.SaveChangesCallCount);
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
        return CreateEvent(0, name, status, Utc(2026, 7, 1, 8));
    }

    private static Event CreateEvent(int id, string name, EventStatus status, DateTime startAtUtc)
    {
        var eventItem = Event.Create(
            name,
            startAtUtc,
            startAtUtc.AddHours(4),
            "Sede LILT",
            "Note",
            status);
        typeof(Event).GetProperty(nameof(Event.Id))!.SetValue(eventItem, id);
        return eventItem;
    }

    private static EventService CreateService(FakeEventRepository repository)
        => new(repository, new FixedTimeProvider(FixedNowUtc));

    private static DateTime Utc(int year, int month, int day, int hour)
        => new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    private sealed class FakeEventRepository : IEventRepository
    {
        public Event? GetByIdResult { get; set; }
        public PagedResult<Event> ListResult { get; set; } = new([], 0);
        public List<Event> Events { get; set; } = [];
        public List<EventParticipation> Participations { get; set; } = [];

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
            var eventItem = GetByIdHandler is null ? GetByIdResult ?? Events.FirstOrDefault(e => e.Id == id) : GetByIdHandler(id);
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

        public Task<PagedResult<ParticipantEventListItem>> ListParticipantEventsAsync(ParticipantEventListFilter filter, int page, int pageSize, CancellationToken ct = default)
        {
            var query = Events
                .Where(e => !e.IsDeleted && e.Status == EventStatus.Active && e.StartAtUtc > filter.NowUtc)
                .Select(e => new ParticipantEventListItem(
                    e,
                    Participations.FirstOrDefault(p => p.EventId == e.Id && p.UserId == filter.UserId)?.Status));

            query = filter.Mode == ParticipantEventListMode.Refused
                ? query.Where(item => item.ParticipationStatus == EventParticipationStatus.Refused)
                : query.Where(item => item.ParticipationStatus is null or EventParticipationStatus.Accepted);

            var ordered = query
                .OrderBy(item => item.Event.StartAtUtc)
                .ThenBy(item => item.Event.Name)
                .ToList();

            var items = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            return Task.FromResult(new PagedResult<ParticipantEventListItem>(items, ordered.Count));
        }

        public Task<EventParticipation?> GetParticipationAsync(int eventId, Guid userId, CancellationToken ct = default)
        {
            return Task.FromResult(Participations.FirstOrDefault(p => p.EventId == eventId && p.UserId == userId));
        }

        public Task AddParticipationAsync(EventParticipation participation, CancellationToken ct = default)
        {
            Participations.Add(participation);
            return Task.CompletedTask;
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

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _now;

        public FixedTimeProvider(DateTime nowUtc)
        {
            _now = new DateTimeOffset(nowUtc);
        }

        public override DateTimeOffset GetUtcNow() => _now;
    }
}