## Interview: Notifications V1 Inbox

Sistema notifiche persistite in PostgreSQL, generiche nel modello ma con un solo trigger iniziale: creazione evento. La V1 resta end-to-end utile per il volontario: generazione atomica in creazione evento, inbox mobile persistita, badge con count unread, stato solo read/unread, niente push, niente realtime, niente backfill storico.

**Steps**
1. Phase 1 — Domain seam and TDD anchor.
   Identificare `EventService.CreateAsync` come seam che controlla il trigger di business. Introdurre nel dominio una nuova entità notifica con interfaccia piccola e profonda: creazione notifica snapshot, transizione a letto, conteggio unread, mark-all-as-read. Questo blocca tutte le fasi successive.
2. Phase 1 — L0 tests first. *depends on 1*
   Aggiungere test L0 in memoria per provare: a) creazione evento genera una notifica per ogni volontario attivo non cancellato; b) utenti Lilt e volontari inattivi/esclusi non ricevono notifiche; c) testo snapshot e `eventId` vengono persistiti; d) `mark as read` e `mark all as read` aggiornano solo le notifiche del chiamante; e) unread count riflette `readAt` nullo/non nullo.
3. Phase 1 — Domain implementation. *depends on 2*
   Estendere il dominio con nuovi tipi richiesta/risposta notifiche e un nuovo seam repository per query e comandi notifiche. Modificare `EventService.CreateAsync` per generare le notifiche nello stesso salvataggio dell'evento. Tenere tutta la logica di targeting nel dominio, non negli endpoint.
4. Phase 2 — Persistence and EF mapping. *depends on 3*
   Estendere EF Core con tabella notifiche PostgreSQL, indici su `user_id`, `read_at`, `created_at`, FK opzionale/obbligatoria verso evento per `EventCreated`, repository EF per insert massivo e query paginata ordinata dal più recente. Gestire tutto nello stesso `DbContext` per mantenere l'atomicità evento + notifiche.
5. Phase 2 — API endpoints. *depends on 4*
   Esporre endpoint autenticati per volontario: lista inbox paginata, unread count, mark single as read, mark all as read. Estrarre l'utente corrente dal token come già fanno gli endpoint eventi personali. Impedire accesso agli utenti non volontari.
6. Phase 2 — L1 API tests. *depends on 5*
   Aggiungere test L1 per contratti HTTP e persistenza reale: la creazione evento produce righe notifica; la lista restituisce cronologia completa con stato letto/non letto; il count unread si aggiorna; apertura/mark read e mark-all operano solo sull'utente autenticato.
7. Phase 3 — Mobile API client and types. *depends on 5, parallel with 6 after API contract is stable*
   Estendere il client mobile con tipi notifica, funzioni fetch inbox, fetch unread count, mark-as-read, mark-all-as-read. Riutilizzare `PagedResponse<T>` e l'infrastruttura auth esistente.
8. Phase 3 — Mobile inbox UI. *depends on 7*
   Aggiungere nuova route drawer Notifiche con lista cronologica persistita, stato visivo read/unread, pull-to-refresh, paginazione coerente con il pattern eventi, azione `Segna tutto come letto`, apertura notifica che marca come letta e naviga al dettaglio evento.
9. Phase 3 — Mobile badge unread. *depends on 7, parallel with 8 if si definisce un piccolo hook/state condiviso*
   Mostrare il conteggio unread nel drawer o nell'entry Notifiche. Aggiornare il badge su load, refresh e dopo azioni di lettura; nessun realtime o polling nella V1.
10. Phase 4 — Final verification. *depends on 6, 8, 9*
    Eseguire L0 mirati, poi L1 mirati, poi verifica mobile locale del percorso inbox → dettaglio evento → badge aggiornato. Confermare che non esista backfill e che non ci siano push o stati extra nella V1.

**Relevant files**
- `c:\dev\volontiamo\src\volontiamo.domain\EventService.cs` — seam di business dove agganciare la generazione notifiche dopo la creazione evento.
- `c:\dev\volontiamo\src\volontiamo.domain\IUserRepository.cs` — da estendere o affiancare con query mirata ai volontari attivi non cancellati destinatari.
- `c:\dev\volontiamo\src\volontiamo.domain.test.L0\EventServiceTests.cs` — primo punto per i test L0 del trigger in creazione evento.
- `c:\dev\volontiamo\src\volontiamo.api\Persistence\AppDbContext.cs` — mapping EF Core della nuova tabella notifiche e relativi indici/FK.
- `c:\dev\volontiamo\src\volontiamo.api\Persistence\UserRepository.cs` — query destinatari e collaborazione col nuovo repository notifiche EF.
- `c:\dev\volontiamo\src\volontiamo.api\Events\EventEndpoints.cs` — riferimento per lo stile endpoint e per il contratto di create event che innesca le notifiche.
- `c:\dev\volontiamo\src\volontiamo.api.tests.L1\EventsEndpointTests.cs` — punto di partenza per provare l'effetto persistito della create event.
- `c:\dev\volontiamo\src\volontiamo.mobile\volontiamo\app\_layout.tsx` — drawer root dove aggiungere entry Notifiche e badge unread.
- `c:\dev\volontiamo\src\volontiamo.mobile\volontiamo\app\(drawer)\events\index.tsx` — pattern UI/refresh/paginazione da riusare per la inbox notifiche.
- `c:\dev\volontiamo\src\volontiamo.mobile\volontiamo\lib\api.ts` — fetch autenticati, mapping payload, nuove chiamate notifiche.
- `c:\dev\volontiamo\src\volontiamo.mobile\volontiamo\lib\types.ts` — tipi TS di notifica, unread count e paged response riusata.

**Verification**
1. L0: `dotnet test .\src\volontiamo.domain.test.L0\volontiamo.domain.test.L0.csproj --filter EventServiceTests`
2. L0 aggiuntivi mirati sul nuovo service/modulo notifiche: test su targeting, snapshot, unread count, mark read, mark all read.
3. L1: `dotnet test .\src\volontiamo.api.tests.L1\volontiamo.api.tests.L1.csproj --filter EventsEndpointTests|Notifications`
4. Build/API smoke: avvio locale API e prova del flusso create event -> lista notifiche -> mark read.
5. Mobile manuale: aprire app Expo Android, verificare drawer badge, inbox cronologica, apertura notifica che segna come letta e naviga al dettaglio evento.

**Decisions**
- Modello dati generico per notifiche, ma nella V1 si implementa solo `EventCreated`.
- Destinatari: soli volontari attivi e non cancellati (`UserType.Volontario`, `IsActive = true`, `IsDeleted = false`).
- Consistenza: creazione evento e notifiche nello stesso salvataggio database.
- Stato: solo unread/read tramite `readAt`; niente archive, delete o mark-as-unread nella V1.
- UX inbox: cronologia completa, ordinata per data più recente; badge con conteggio unread esatto.
- Lettura: la notifica diventa letta all'apertura/tap; esiste anche `mark all as read`.
- Contenuto: snapshot persistito di titolo/testo + `eventId` per aprire il dettaglio evento.
- Rollout: nessun backfill storico; solo eventi creati dopo il rilascio.
- Scope V1: backend/API + mobile inbox + badge. Esclusi web backoffice notifiche, push di sistema, realtime, polling, templating avanzato.