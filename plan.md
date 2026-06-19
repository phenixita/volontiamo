## Interview: Partecipazione eventi mobile

Implementare la partecipazione agli eventi per l'app mobile mantenendo separata la lista backoffice esistente. L'approccio consigliato e deciso e': aggiungere una relazione molti-a-molti evento-utente con stato `Accepted`/`Refused`, nessun record per gli eventi non ancora scelti, una query dedicata per gli eventi dell'utente corrente e un singolo comando idempotente per cambiare stato. La lista mobile mostra solo eventi `Active` con `StartAtUtc > now`; la vista principale esclude i rifiutati, mentre il filtro `Mostra rifiutati` mostra solo rifiutati attivi e futuri.

**Steps**

### Phase 1: Domain model and rules
1. Add `EventParticipationStatus` enum with `Accepted` and `Refused` only. No `Pending`: a missing row means the user has not answered.
2. Add `EventParticipation` entity with `EventId`, `UserId`, `Status`, `CreatedAt`, `UpdatedAt`, plus a method to change status and refresh `UpdatedAt`.
3. Add participant-facing request/response records, e.g. `ParticipantEventListRequest`, `ParticipantEventListMode` (`Available`/`Refused`), `ParticipantEventResponse`, and `SetEventParticipationRequest`.
4. Add `EventParticipationService` or participant-focused methods on `EventService` with a small interface:
   - list current user's selectable events, normalized pagination, using `TimeProvider.GetUtcNow()`;
   - set current user's status to `Accepted` or `Refused`;
   - reject changes when the event is missing, not `Active`, deleted, or already started.
5. Keep the existing `EventService.ListAsync` behavior unchanged for backoffice/admin event management.

### Phase 2: Persistence
6. Extend persistence behind the existing event seam, preferably by extending `IEventRepository` with participant-focused operations rather than introducing a second repository seam too early:
   - `ListParticipantEventsAsync(filter, page, pageSize, ct)` returning event plus nullable participation status;
   - `GetParticipationAsync(eventId, userId, ct)`;
   - `AddParticipationAsync(participation, ct)` or `UpsertParticipationStatusAsync(...)` depending on the cleanest EF implementation.
7. Configure `AppDbContext` with `DbSet<EventParticipation>` and table `event_participations`:
   - composite key `(event_id, user_id)`;
   - FK to `events.id` and `users.id`;
   - `participation_status`, `created_at`, `updated_at` columns;
   - indexes for `user_id`, `event_id`, and `(user_id, participation_status)` if useful for the mobile query.
8. Add an EF migration for the new table. This blocks L1 tests and manual API use.

### Phase 3: API contracts and endpoints
9. Add API contracts in `src/volontiamo.api/Events/Contracts.cs` only if API-specific DTOs are needed; otherwise reuse domain request/response records consistently with current event endpoints.
10. Add `GET /api/v1/events/my?view=available|refused&page=&pageSize=`:
    - authenticate via bearer token;
    - extract current `userId` from `ClaimTypes.NameIdentifier`;
    - default `view=available`;
    - `available` returns active future events where current user has no participation row or `Accepted`;
    - `refused` returns only active future events where current user has `Refused`.
11. Add `PUT /api/v1/events/{id:int}/participation` with body `{ status: "Accepted" | "Refused" }`:
    - authenticated users of any `UserType` can set status, per decision;
    - create row on first choice;
    - update row when changing between `Accepted` and `Refused`;
    - return the updated participant event or status payload;
    - return `404` for missing event and `409` for events not selectable because they are draft, concluded, deleted, or already started.
12. Leave existing `GET /api/v1/events`, `POST /api/v1/events`, and `DELETE /api/v1/events/{id}` unchanged for backoffice.

### Phase 4: Mobile API client and types
13. Update `src/volontiamo.mobile/volontiamo/lib/types.ts`:
    - add `ParticipationStatus = 'Accepted' | 'Refused'`;
    - add `ParticipantEventResponse` without `status`, or with `participationStatus` only, so the mobile screen no longer depends on the event lifecycle badge.
14. Update `src/volontiamo.mobile/volontiamo/lib/api.ts`:
    - add mapper for participation status;
    - add `fetchMyEvents(view, page, pageSize)` calling `/events/my`;
    - add `setEventParticipation(eventId, status)` calling `PUT /events/{id}/participation`;
    - keep graceful empty-list fallback for list failures, but return actionable `ApiResult` for status changes.

### Phase 5: Mobile UI
15. Update `src/volontiamo.mobile/volontiamo/app/(drawer)/events.tsx`:
    - replace `fetchEvents` with `fetchMyEvents`;
    - add top filter `Mostra rifiutati` that switches `view` between `available` and `refused`, resets pagination, and reloads page 1;
    - remove the status badge and the `statusLabel`, `statusBadgeStyle`, and `statusTextStyle` helpers;
    - show two stable actions on every card: `Partecipo` and `Rifiuto`, with selected/disabled styling for the current state;
    - in available view, setting `Refused` removes the card from the list after success;
    - in refused view, setting `Accepted` removes the card from the refused list after success;
    - support loading state per event while the participation update is in flight;
    - keep pull-to-refresh and infinite scroll behavior.
16. Keep app scope mobile-only: do not update `volontiamo.web` in this work.

### Phase 6: Tests and verification
17. Add/extend L0 tests in `src/volontiamo.domain.test.L0/EventServiceTests.cs` or a new `EventParticipationServiceTests.cs`:
    - available list includes active future unselected and accepted events;
    - available list excludes refused events;
    - refused view returns only refused active future events;
    - draft, concluded, deleted, and already-started events are excluded or rejected;
    - first choice creates participation;
    - changing `Accepted` to `Refused` and back updates the existing row;
    - missing event returns `NotFound`;
    - use fake in-memory repository implementations, no mocking libraries.
18. Add/extend L1 tests in `src/volontiamo.api.tests.L1/EventsEndpointTests.cs`:
    - `GET /api/v1/events/my` requires bearer token;
    - default available view returns active future events only and hides refused;
    - `view=refused` returns only refused active future events;
    - `PUT /events/{id}/participation` creates and updates status;
    - status changes after event start or on draft/concluded events return `409`;
    - existing `/api/v1/events` list behavior remains unchanged.
19. Run automated verification from workspace root:
    - `dotnet test .\src\volontiamo.domain.test.L0\volontiamo.domain.test.L0.csproj`
    - `dotnet test .\src\volontiamo.api.tests.L1\volontiamo.api.tests.L1.csproj` with Docker available.
20. Run mobile static verification from `src/volontiamo.mobile/volontiamo`:
    - `npx tsc --noEmit` because `package.json` has no dedicated typecheck script.
21. Manual verification:
    - run `./start-manual-test.ps1` from workspace root;
    - login in the mobile app;
    - confirm draft events no longer appear;
    - confirm active future events appear without the status tag;
    - tap `Rifiuto` and confirm the card disappears;
    - enable `Mostra rifiutati` and confirm the refused event appears;
    - tap `Partecipo` there and confirm it disappears from refused and reappears in available.

**Relevant files**
- `c:/dev/volontiamo/src/volontiamo.domain/Event.cs` — add or reference event lifecycle rules; existing `EventStatus` remains source of active/draft/concluded state.
- `c:/dev/volontiamo/src/volontiamo.domain/EventService.cs` — keep admin list/create/delete behavior; add participant list/change behavior here or adjacent in a dedicated service.
- `c:/dev/volontiamo/src/volontiamo.domain/IEventRepository.cs` — extend the event persistence seam for participant queries and upsert/get participation operations.
- `c:/dev/volontiamo/src/volontiamo.api/Persistence/AppDbContext.cs` — configure `event_participations` table and EF mapping.
- `c:/dev/volontiamo/src/volontiamo.api/Persistence/EventRepository.cs` — implement joined participant queries and participation upsert/change.
- `c:/dev/volontiamo/src/volontiamo.api/Events/EventEndpoints.cs` — add `GET /events/my` and `PUT /events/{id}/participation` while preserving current endpoints.
- `c:/dev/volontiamo/src/volontiamo.api/Program.cs` — register any new service with DI; `TimeProvider.System` already exists.
- `c:/dev/volontiamo/src/volontiamo.mobile/volontiamo/lib/types.ts` — add participant event and participation status types.
- `c:/dev/volontiamo/src/volontiamo.mobile/volontiamo/lib/api.ts` — add mobile event list and status update calls.
- `c:/dev/volontiamo/src/volontiamo.mobile/volontiamo/app/(drawer)/events.tsx` — implement filter, remove event status tag, and add participation actions.
- `c:/dev/volontiamo/src/volontiamo.domain.test.L0/EventServiceTests.cs` or new `EventParticipationServiceTests.cs` — L0 rules with fake repositories.
- `c:/dev/volontiamo/src/volontiamo.api.tests.L1/EventsEndpointTests.cs` — endpoint integration coverage with PostgreSQL Testcontainers.

**Verification**
1. L0 domain: `dotnet test .\src\volontiamo.domain.test.L0\volontiamo.domain.test.L0.csproj`.
2. L1 API/Postgres: `dotnet test .\src\volontiamo.api.tests.L1\volontiamo.api.tests.L1.csproj`.
3. Mobile TypeScript: from `src/volontiamo.mobile/volontiamo`, run `npx tsc --noEmit`.
4. Manual app flow through `./start-manual-test.ps1` and Expo Android.

**Decisions**
- Missing participation row means the user has not answered; no `Pending` row is created.
- `Mostra rifiutati` is exclusive: it shows only refused events.
- Both normal and refused views are limited to active future events.
- Changing choice is allowed only before event start.
- Users can only switch between `Accepted` and `Refused`; there is no reset to unanswered.
- LILT/staff users are allowed by the API to set participation too, even though `volontiamo.mobile` is volunteer-focused.
- Existing backoffice `/api/v1/events` behavior remains unchanged.
- `volontiamo.web` is out of scope for this change.
