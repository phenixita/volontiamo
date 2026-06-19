## Interview: Dettaglio eventi backoffice

Implementare una prima bozza del dettaglio evento nel backoffice web: dalla lista eventi il titolo diventa un link al dettaglio, la lista mostra ID evento e numero di volontari accettati, la cancellazione viene rimossa dalla lista e spostata nel dettaglio. Il conteggio e la lista volontari richiedono modifiche backend/domain/API per esporre aggregati e partecipanti accettati, poi aggiornamenti dei contratti e delle pagine Next.js.

**Steps**
1. Aggiornare il dominio con nuovi contratti di lettura evento backoffice (*blocca 2, 3, 4*):
   - Estendere `EventResponse` con `AcceptedParticipantsCount` oppure introdurre un item di lista dedicato se il cambio di contratto risulta più pulito durante l'implementazione.
   - Aggiungere un contratto per il dettaglio, per esempio `EventDetailResponse`, che includa dati evento, `AcceptedParticipantsCount` e lista di volontari accettati.
   - Aggiungere un record per volontario evento, con `UserId`, `FirstName`, `LastName`, `Email`, `Phone`.
2. Estendere l'interfaccia repository eventi (*dipende da 1*):
   - Aggiungere un modulo/query dietro `IEventRepository` per leggere lista eventi con conteggio accettati.
   - Aggiungere lettura dettaglio per id con volontari accettati.
   - Mantenere la seam su `IEventRepository`, evitando logica business in `volontiamo.api`.
3. Scrivere/aggiornare test L0 dominio (*dipende da 1, 2; può guidare 4*):
   - Testare che `ListAsync` mappi `AcceptedParticipantsCount` e conti solo `EventParticipationStatus.Accepted`, non `Refused`.
   - Testare nuovo metodo dettaglio: not found se evento assente; successo con evento, conteggio accettati e dati volontari accettati.
   - Aggiornare `FakeEventRepository` in memoria, senza mocking library.
4. Implementare `EventService` (*dipende da 1, 2, 3*):
   - Aggiungere metodo dettaglio, ad esempio `GetDetailAsync(int id, CancellationToken ct)`.
   - Mappare i nuovi DTO mantenendo validazioni e soft-delete coerenti con la lista.
5. Implementare repository EF Core (*dipende da 2, 4*):
   - In `EventRepository`, usare query aggregate su `EventParticipations` filtrando `Status == Accepted`.
   - Per il dettaglio, recuperare evento non cancellato e volontari accettati joinando `Users`, ordinati per cognome/nome.
   - Evitare N+1 query nella lista: preferire group/join o subquery traducibile da EF.
6. Aggiornare endpoint API (*dipende da 4, 5*):
   - Aggiungere `GET /api/v1/events/{id:int}` prima delle route più generiche dove serve.
   - Restituire 200 con dettaglio o 404 problem se evento non trovato.
   - Lasciare `DELETE /api/v1/events/{id:int}` invariato, usato dalla pagina dettaglio.
7. Scrivere/aggiornare test L1 API (*dipende da 6; può essere in parallelo con 8 dopo i contratti*):
   - Verificare che `GET /api/v1/events` includa conteggio accettati e ignori rifiutati.
   - Verificare `GET /api/v1/events/{id}` con dati evento, volontari accettati e 404 per evento inesistente.
   - Verificare che la cancellazione continui a escludere l'evento dalla lista.
8. Aggiornare contratti/adattatore web (*dipende da 6*):
   - Estendere `EventDto` con `acceptedParticipantsCount`.
   - Aggiungere `EventDetailDto`, `EventVolunteerDto` e risultato di lettura dettaglio.
   - Aggiungere funzione adapter `readEventDetail(id)` con validazione runtime del payload.
   - Riutilizzare `deleteEvent` esistente per la pagina dettaglio.
9. Aggiornare pagina lista eventi (*dipende da 8*):
   - Aggiungere colonna ID evento come prima colonna.
   - Rendere il titolo evento un `Link` a `/events/{id}`.
   - Aggiungere colonna volontari con `acceptedParticipantsCount`.
   - Rimuovere colonna/pulsante elimina.
   - Adeguare `min-w` tabella solo quanto necessario.
10. Creare pagina dettaglio Next.js (*dipende da 8; parallelo con 9 dopo adapter*):
   - Nuova route `app/events/[id]/page.tsx`.
   - Fare `requireCurrentUser`, leggere dettaglio via adapter e gestire stati errore/not found.
   - Mostrare riepilogo evento, periodo, luogo, stato, note markdown, conteggio volontari accettati.
   - Mostrare tabella/lista volontari accettati con nome, cognome, email, telefono.
   - Aggiungere comando elimina con conferma, usando `deleteEventAction` o nuova action dedicata che dopo successo reindirizzi a `/events`.
11. Verifica automatica (*dipende da 3-10*):
   - Eseguire L0 dominio: `dotnet test src/volontiamo.domain.test.L0/volontiamo.domain.test.L0.csproj`.
   - Eseguire L1 API: `dotnet test src/volontiamo.api.tests.L1/volontiamo.api.tests.L1.csproj`.
   - Eseguire controlli web disponibili nel package Next.js, verificando `package.json` prima di scegliere comando esatto.
12. Verifica manuale (*dipende da 11*):
   - Avviare API/web come da setup locale se necessario.
   - Aprire `/events`, verificare colonne ID, Evento linkato, Volontari, assenza Elimina.
   - Entrare in `/events/{id}`, verificare riepilogo, lista volontari accettati, cancellazione con redirect alla lista.

**Relevant files**
- `c:/dev/volontiamo/src/volontiamo.domain/EventService.cs` — aggiungere contratti e metodo dettaglio; mappare count/lista volontari.
- `c:/dev/volontiamo/src/volontiamo.domain/IEventRepository.cs` — ampliare la seam del repository con query di lista/dettaglio arricchite.
- `c:/dev/volontiamo/src/volontiamo.api/Persistence/EventRepository.cs` — implementare query EF Core per count accepted e volontari accettati.
- `c:/dev/volontiamo/src/volontiamo.api/Events/EventEndpoints.cs` — aggiungere endpoint dettaglio e mappare 404.
- `c:/dev/volontiamo/src/volontiamo.domain.test.L0/EventServiceTests.cs` — test in memoria dei nuovi comportamenti dominio.
- `c:/dev/volontiamo/src/volontiamo.api.tests.L1/EventsEndpointTests.cs` — test integrazione endpoint e aggregazioni Postgres.
- `c:/dev/volontiamo/src/volontiamo.web/volontiamo/lib/events/contracts.ts` — aggiornare DTO TypeScript.
- `c:/dev/volontiamo/src/volontiamo.web/volontiamo/lib/events/http-events-adapter.ts` — aggiungere lettura dettaglio e validazione payload.
- `c:/dev/volontiamo/src/volontiamo.web/volontiamo/app/events/page.tsx` — aggiornare tabella lista eventi.
- `c:/dev/volontiamo/src/volontiamo.web/volontiamo/app/events/[id]/page.tsx` — nuova pagina dettaglio.
- `c:/dev/volontiamo/src/volontiamo.web/volontiamo/app/events/actions.ts` — riusare o adattare redirect delete dal dettaglio.

**Verification**
1. `dotnet test src/volontiamo.domain.test.L0/volontiamo.domain.test.L0.csproj` deve passare.
2. `dotnet test src/volontiamo.api.tests.L1/volontiamo.api.tests.L1.csproj` deve passare.
3. Comando web da `src/volontiamo.web/volontiamo/package.json`, preferibilmente lint/typecheck se presente.
4. Manuale: `/events` mostra ID, titolo linkato, count accettati e non mostra elimina.
5. Manuale: `/events/{id}` mostra dettaglio, volontari accettati con nome/cognome/email/telefono, elimina con conferma e redirect.

**Decisions**
- Conteggio volontari: solo `EventParticipationStatus.Accepted`.
- Lista volontari nel dettaglio: nome, cognome, email, telefono.
- Eliminazione: rimossa dalla lista, disponibile nel dettaglio con conferma.
- Route web dettaglio: `/events/{id}`.
- Incluso: backend/domain/API, web contracts, lista e dettaglio web, test L0/L1 pertinenti.
- Escluso: modifica della partecipazione volontari dal backoffice, conteggio rifiutati, lista volontari rifiutati, editing evento nel dettaglio, nuove migrazioni database salvo necessità emersa durante implementazione.
