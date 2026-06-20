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
        var repository = new FakeEventRepository { ListResult = new PagedResult<EventListItem>([], 0) };
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
            ListHandler = (_, _, _) => new PagedResult<EventListItem>([new EventListItem(eventItem, 2, 1)], 1)
        };
        var service = new EventService(repository);

        var result = await service.ListAsync(new EventListRequest(null, null, Page: 0, PageSize: 999));

        Assert.Equal(1, repository.LastListPage);
        Assert.Equal(100, repository.LastListPageSize);
        Assert.Equal(1, result.Page);
        Assert.Equal(100, result.PageSize);
        Assert.Single(result.Items);
        Assert.Equal("Screening", result.Items[0].Name);
        Assert.Equal(2, result.Items[0].CandidataParticipantsCount);
        Assert.Equal(1, result.Items[0].PartecipaParticipantsCount);
    }

    [Fact]
    public async Task GetDetailAsync_WhenEventDoesNotExist_ReturnsNotFound()
    {
        var repository = new FakeEventRepository();
        var service = new EventService(repository);

        var result = await service.GetDetailAsync(999);

        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task GetDetailAsync_WhenEventExists_MapsParticipantsByStatus()
    {
        var eventItem = CreateEvent(id: 77, name: "Dettaglio", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var participants = new List<EventParticipant>
        {
            new(Guid.NewGuid(), "Mario", "Rossi", "mario.rossi@example.com", "+391111111111", EventParticipationStatus.Candidata),
            new(Guid.NewGuid(), "Luca", "Verdi", "luca.verdi@example.com", "+392222222222", EventParticipationStatus.Partecipa),
            new(Guid.NewGuid(), "Anna", "Bianchi", "anna.bianchi@example.com", null, EventParticipationStatus.NonInteressata),
            new(Guid.NewGuid(), "Paola", "Neri", "paola.neri@example.com", null, EventParticipationStatus.Rifiutata)
        };

        var repository = new FakeEventRepository
        {
            GetDetailByIdResult = new EventDetailItem(eventItem, participants)
        };
        var service = new EventService(repository);

        var result = await service.GetDetailAsync(eventItem.Id);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal(eventItem.Id, result.Value!.Id);
        var candidata = Assert.Single(result.Value.CandidataParticipants);
        var partecipa = Assert.Single(result.Value.PartecipaParticipants);
        var nonInteressata = Assert.Single(result.Value.NonInteressataParticipants);
        var rifiutata = Assert.Single(result.Value.RifiutataParticipants);
        Assert.Equal("Mario", candidata.FirstName);
        Assert.Equal("luca.verdi@example.com", partecipa.Email);
        Assert.Equal("Anna", nonInteressata.FirstName);
        Assert.Equal("Paola", rifiutata.FirstName);
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
    public async Task ListParticipantEventsAsync_AvailableIncludesActiveFutureEventsExceptNonInteressata()
    {
        var userId = Guid.NewGuid();
        var unselected = CreateEvent(id: 1, name: "Unselected", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var candidata = CreateEvent(id: 2, name: "Candidata", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(2));
        var partecipa = CreateEvent(id: 3, name: "Partecipa", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(3));
        var rifiutata = CreateEvent(id: 4, name: "Rifiutata", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(4));
        var nonInteressata = CreateEvent(id: 5, name: "NonInteressata", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(5));
        var repository = new FakeEventRepository
        {
            Events = [unselected, candidata, partecipa, rifiutata, nonInteressata],
            Participations =
            [
                EventParticipation.Create(candidata.Id, userId, EventParticipationStatus.Candidata, FixedNowUtc),
                EventParticipation.Create(partecipa.Id, userId, EventParticipationStatus.Partecipa, FixedNowUtc),
                EventParticipation.Create(rifiutata.Id, userId, EventParticipationStatus.Rifiutata, FixedNowUtc),
                EventParticipation.Create(nonInteressata.Id, userId, EventParticipationStatus.NonInteressata, FixedNowUtc)
            ]
        };
        var service = CreateService(repository);

        var result = await service.ListParticipantEventsAsync(new ParticipantEventListRequest(userId, ParticipantEventListMode.Available, 1, 10));

        Assert.Equal(4, result.TotalCount);
        Assert.Equal(["Unselected", "Candidata", "Partecipa", "Rifiutata"], result.Items.Select(e => e.Name).ToArray());
        Assert.Null(result.Items[0].ParticipationStatus);
        Assert.Equal(EventParticipationStatus.Candidata, result.Items[1].ParticipationStatus);
        Assert.Equal(EventParticipationStatus.Partecipa, result.Items[2].ParticipationStatus);
        Assert.Equal(EventParticipationStatus.Rifiutata, result.Items[3].ParticipationStatus);
    }

    [Fact]
    public async Task ListParticipantEventsAsync_NonInteressataReturnsOnlyNonInteressataActiveFutureEvents()
    {
        var userId = Guid.NewGuid();
        var nonInteressata = CreateEvent(id: 1, name: "NonInteressata", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var candidata = CreateEvent(id: 2, name: "Candidata", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(2));
        var repository = new FakeEventRepository
        {
            Events = [nonInteressata, candidata],
            Participations =
            [
                EventParticipation.Create(nonInteressata.Id, userId, EventParticipationStatus.NonInteressata, FixedNowUtc),
                EventParticipation.Create(candidata.Id, userId, EventParticipationStatus.Candidata, FixedNowUtc)
            ]
        };
        var service = CreateService(repository);

        var result = await service.ListParticipantEventsAsync(new ParticipantEventListRequest(userId, ParticipantEventListMode.NonInteressata, 1, 10));

        Assert.Single(result.Items);
        Assert.Equal("NonInteressata", result.Items[0].Name);
        Assert.Equal(EventParticipationStatus.NonInteressata, result.Items[0].ParticipationStatus);
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
    public async Task ApplyAsync_WhenFirstChoice_CreatesCandidataParticipation()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 11, name: "Selectable", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.ApplyAsync(eventItem.Id, userId);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.Equal(EventParticipationStatus.Candidata, result.Value!.ParticipationStatus);
        var participation = Assert.Single(repository.Participations);
        Assert.Equal(eventItem.Id, participation.EventId);
        Assert.Equal(userId, participation.UserId);
        Assert.Equal(EventParticipationStatus.Candidata, participation.Status);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task MarkAsNotInterestedAsync_WhenFirstChoice_CreatesNonInteressataParticipation()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 12, name: "Selectable", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.MarkAsNotInterestedAsync(eventItem.Id, userId);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.Single(repository.Participations);
        Assert.Equal(EventParticipationStatus.NonInteressata, repository.Participations[0].Status);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task RestoreAvailabilityAsync_WhenParticipationIsNonInteressata_RemovesParticipation()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 13, name: "Selectable", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var participation = EventParticipation.Create(eventItem.Id, userId, EventParticipationStatus.NonInteressata, FixedNowUtc.AddDays(-1));
        var repository = new FakeEventRepository { Events = [eventItem], Participations = [participation] };
        var service = CreateService(repository);

        var result = await service.RestoreAvailabilityAsync(eventItem.Id, userId);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.Empty(repository.Participations);
        Assert.Null(result.Value!.ParticipationStatus);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task ApplyAsync_WhenExistingParticipationPreventsTransition_ReturnsConflict()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 14, name: "Selectable", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var participation = EventParticipation.Create(eventItem.Id, userId, EventParticipationStatus.NonInteressata, FixedNowUtc.AddDays(-1));
        var repository = new FakeEventRepository { Events = [eventItem], Participations = [participation] };
        var service = CreateService(repository);

        var result = await service.ApplyAsync(eventItem.Id, userId);

        Assert.Equal(ResultStatus.Conflict, result.Status);
        Assert.Equal(EventParticipationStatus.NonInteressata, participation.Status);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Theory]
    [InlineData(EventStatus.Draft, 1)]
    [InlineData(EventStatus.Concluded, 1)]
    [InlineData(EventStatus.Active, -1)]
    public async Task VolunteerTransitions_WhenEventIsNotSelectable_ReturnConflict(EventStatus status, int startOffsetHours)
    {
        var eventItem = CreateEvent(id: 15, name: "Maybe selectable", status: status, startAtUtc: FixedNowUtc.AddHours(startOffsetHours));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var applyResult = await service.ApplyAsync(eventItem.Id, Guid.NewGuid());
        var notInterestedResult = await service.MarkAsNotInterestedAsync(eventItem.Id, Guid.NewGuid());

        Assert.Equal(ResultStatus.Conflict, applyResult.Status);
        Assert.Equal(ResultStatus.Conflict, notInterestedResult.Status);
        Assert.Empty(repository.Participations);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task VolunteerTransitions_WhenEventIsDeleted_ReturnNotFound()
    {
        var eventItem = CreateEvent(id: 19, name: "Deleted", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        eventItem.SoftDelete();
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var applyResult = await service.ApplyAsync(eventItem.Id, Guid.NewGuid());
        var notInterestedResult = await service.MarkAsNotInterestedAsync(eventItem.Id, Guid.NewGuid());

        Assert.Equal(ResultStatus.NotFound, applyResult.Status);
        Assert.Equal(ResultStatus.NotFound, notInterestedResult.Status);
        Assert.Empty(repository.Participations);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task AcceptCandidateAsync_WhenParticipationIsCandidata_SetsPartecipa()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 16, name: "Con candidatura", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var participation = EventParticipation.Create(eventItem.Id, userId, EventParticipationStatus.Candidata, FixedNowUtc.AddDays(-1));
        var repository = new FakeEventRepository { Events = [eventItem], Participations = [participation] };
        var service = CreateService(repository);

        var result = await service.AcceptCandidateAsync(eventItem.Id, userId);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.True(result.Value);
        Assert.Equal(EventParticipationStatus.Partecipa, participation.Status);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task RejectCandidateAsync_WhenParticipationIsCandidata_SetsRifiutata()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 17, name: "Con candidatura", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var participation = EventParticipation.Create(eventItem.Id, userId, EventParticipationStatus.Candidata, FixedNowUtc.AddDays(-1));
        var repository = new FakeEventRepository { Events = [eventItem], Participations = [participation] };
        var service = CreateService(repository);

        var result = await service.RejectCandidateAsync(eventItem.Id, userId);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.True(result.Value);
        Assert.Equal(EventParticipationStatus.Rifiutata, participation.Status);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task FinalizeCandidateAsync_WhenParticipationIsNotCandidata_ReturnsConflict()
    {
        var userId = Guid.NewGuid();
        var eventItem = CreateEvent(id: 18, name: "Finale", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var participation = EventParticipation.Create(eventItem.Id, userId, EventParticipationStatus.Partecipa, FixedNowUtc.AddDays(-1));
        var repository = new FakeEventRepository { Events = [eventItem], Participations = [participation] };
        var service = CreateService(repository);

        var result = await service.RejectCandidateAsync(eventItem.Id, userId);

        Assert.Equal(ResultStatus.Conflict, result.Status);
        Assert.Equal(EventParticipationStatus.Partecipa, participation.Status);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenRequestIsValid_UpdatesEventAndPersists()
    {
        var eventItem = CreateEvent(id: 20, name: "Originale", status: EventStatus.Draft, startAtUtc: Utc(2026, 7, 1, 8));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.UpdateAsync(eventItem.Id, ValidUpdateRequest(name: "  Aggiornato  ", location: "  ", status: EventStatus.Active));

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.True(result.Value);
        Assert.Equal("Aggiornato", eventItem.Name);
        Assert.Null(eventItem.Location);
        Assert.Equal(EventStatus.Active, eventItem.Status);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenEventIsMissing_ReturnsNotFound()
    {
        var repository = new FakeEventRepository();
        var service = CreateService(repository);

        var result = await service.UpdateAsync(404, ValidUpdateRequest());

        Assert.Equal(ResultStatus.NotFound, result.Status);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenEventIsDeleted_ReturnsNotFound()
    {
        var eventItem = CreateEvent(id: 21, name: "Cancellato", status: EventStatus.Draft, startAtUtc: Utc(2026, 7, 1, 8));
        eventItem.SoftDelete();
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.UpdateAsync(eventItem.Id, ValidUpdateRequest());

        Assert.Equal(ResultStatus.NotFound, result.Status);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenEndIsBeforeStart_ReturnsValidationError()
    {
        var eventItem = CreateEvent(id: 22, name: "Da validare", status: EventStatus.Draft, startAtUtc: Utc(2026, 7, 1, 8));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.UpdateAsync(eventItem.Id, ValidUpdateRequest() with
        {
            StartAtUtc = Utc(2026, 7, 1, 10),
            EndAtUtc = Utc(2026, 7, 1, 9)
        });

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "endAtUtc");
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenNameIsBlank_ReturnsValidationError()
    {
        var eventItem = CreateEvent(id: 23, name: "Da validare", status: EventStatus.Draft, startAtUtc: Utc(2026, 7, 1, 8));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.UpdateAsync(eventItem.Id, ValidUpdateRequest(name: "   "));

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "name");
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenDatesAreNotUtc_ReturnsValidationError()
    {
        var eventItem = CreateEvent(id: 24, name: "Da validare", status: EventStatus.Draft, startAtUtc: Utc(2026, 7, 1, 8));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.UpdateAsync(eventItem.Id, ValidUpdateRequest() with
        {
            StartAtUtc = new DateTime(2026, 7, 1, 8, 0, 0, DateTimeKind.Unspecified)
        });

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "startAtUtc");
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task RestoreAvailabilityAsync_WhenParticipationIsMissing_ReturnsConflict()
    {
        var eventItem = CreateEvent(id: 30, name: "Senza volontario", status: EventStatus.Active, startAtUtc: FixedNowUtc.AddDays(1));
        var repository = new FakeEventRepository { Events = [eventItem] };
        var service = CreateService(repository);

        var result = await service.RestoreAvailabilityAsync(eventItem.Id, Guid.NewGuid());

        Assert.Equal(ResultStatus.Conflict, result.Status);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task ApplyAsync_WhenEventIsMissing_ReturnsNotFound()
    {
        var repository = new FakeEventRepository();
        var service = CreateService(repository);

        var result = await service.ApplyAsync(404, Guid.NewGuid());

        Assert.Equal(ResultStatus.NotFound, result.Status);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task AcceptCandidateAsync_WhenEventIsMissing_ReturnsNotFound()
    {
        var repository = new FakeEventRepository();
        var service = CreateService(repository);

        var result = await service.AcceptCandidateAsync(404, Guid.NewGuid());

        Assert.Equal(ResultStatus.NotFound, result.Status);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    private static UpdateEventRequest ValidUpdateRequest(
        string name = "Giornata aggiornata",
        string? location = "Sede LILT",
        string? notes = "## Operativo\n- Accoglienza volontari",
        EventStatus status = EventStatus.Active)
    {
        return new UpdateEventRequest(
            Name: name,
            StartAtUtc: Utc(2026, 7, 1, 8),
            EndAtUtc: Utc(2026, 7, 1, 12),
            Location: location,
            OperationalNotesMarkdown: notes,
            Status: status);
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
        public EventDetailItem? GetDetailByIdResult { get; set; }
        public PagedResult<EventListItem> ListResult { get; set; } = new([], 0);
        public List<Event> Events { get; set; } = [];
        public List<EventParticipation> Participations { get; set; } = [];

        public Func<int, Event?>? GetByIdHandler { get; set; }
        public Func<int, EventDetailItem?>? GetDetailByIdHandler { get; set; }
        public Func<EventListFilter, int, int, PagedResult<EventListItem>>? ListHandler { get; set; }

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

        public Task<EventDetailItem?> GetDetailByIdAsync(int id, CancellationToken ct = default)
        {
            var detail = GetDetailByIdHandler is null
                ? GetDetailByIdResult
                : GetDetailByIdHandler(id);
            return Task.FromResult(detail);
        }

        public Task<PagedResult<EventListItem>> ListAsync(EventListFilter filter, int page, int pageSize, CancellationToken ct = default)
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

            query = filter.Mode == ParticipantEventListMode.NonInteressata
                ? query.Where(item => item.ParticipationStatus == EventParticipationStatus.NonInteressata)
                : query.Where(item => item.ParticipationStatus != EventParticipationStatus.NonInteressata);

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

        public Task RemoveParticipationAsync(EventParticipation participation, CancellationToken ct = default)
        {
            Participations.Remove(participation);
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