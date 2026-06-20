## Plan: Undo rifiuto candidatura

Prima di implementare, il lavoro viene diviso per stack e per applicazione coinvolta. L'obiettivo e mantenere seam chiari tra dominio, adapter REST e adapter web, con test al livello piu basso possibile prima di salire di livello.

## Analisi stack e applicazioni coinvolte

| Area | Stack | Ruolo nel flusso | Impatto |
| --- | --- | --- | --- |
| `src\volontiamo.domain` | C# / .NET 10 | logica di business e regole del caso d'uso | **diretto** |
| `src\volontiamo.domain.test.L0` | xUnit / test L0 in memoria | copertura unitaria del nuovo comportamento | **diretto** |
| `src\volontiamo.api` | ASP.NET Core / EF Core / PostgreSQL | esposizione endpoint REST backoffice, senza business logic | **diretto** |
| `src\volontiamo.api.tests.L1` | test L1 API | verifica integrazione endpoint + persistenza/read model | **diretto** |
| `src\volontiamo.web\volontiamo` | Next.js 16 / React 19 / TypeScript | backoffice LILT: adapter HTTP, server action, UI dettaglio evento | **diretto** |
| `src\volontiamo.mobile\volontiamo` | Expo / React Native | client volontario | **nessun intervento previsto** |

## Strategia di suddivisione in subagent

### Subagent 1 - Domain + L0
- **Scope**: `volontiamo.domain`, `volontiamo.domain.test.L0`
- **Stack**: C# / .NET 10
- **Obiettivo**: introdurre il caso d'uso `UndoRejectCandidate` nel dominio, mantenendo tutta la semantica nel modulo profondo `EventService`.
- **Responsabilita**:
  1. aggiungere il metodo dominio dedicato;
  2. riusare le guardie gia esistenti di selezionabilita;
  3. rimuovere solo partecipazioni in stato `Rifiutata`;
  4. coprire il comportamento con test L0 usando implementazioni in memoria gia esistenti.
- **Output atteso**: contratto dominio stabile e testato, pronto per essere consumato dall'API.

### Subagent 2 - API + L1
- **Scope**: `volontiamo.api`, `volontiamo.api.tests.L1`
- **Stack**: ASP.NET Core / EF Core / PostgreSQL
- **Obiettivo**: esporre il caso d'uso via endpoint REST backoffice coerente con le route esistenti.
- **Responsabilita**:
  1. aggiungere route `DELETE /api/v1/events/{eventId}/candidates/{userId}/reject`;
  2. delegare solo al dominio, senza spostare business logic nell'API;
  3. mappare correttamente `204`, `404`, `409`;
  4. aggiungere test L1 end-to-end sul nuovo endpoint e sul read model risultante.
- **Dipendenza principale**: richiede il contratto definito dal Subagent 1.
- **Output atteso**: seam REST stabile per il backoffice.

### Subagent 3 - Web backoffice
- **Scope**: `src\volontiamo.web\volontiamo`
- **Stack**: Next.js 16 / React 19 / TypeScript
- **Obiettivo**: collegare il nuovo endpoint al backoffice LILT con il minimo delta UI coerente con i pattern esistenti.
- **Responsabilita**:
  1. aggiungere funzione adapter HTTP `undoRejectCandidate`;
  2. aggiungere server action con `revalidatePath` + `redirect`;
  3. esporre il bottone solo nella sezione `Rifiutata`;
  4. non introdurre stato client, modali o logica duplicata.
- **Dipendenza principale**: richiede la route del Subagent 2.
- **Output atteso**: flusso backoffice completo e coerente.

### Subagent 4 - Verifica trasversale
- **Scope**: test ed esecuzione finale
- **Stack**: .NET test runner + toolchain web gia presente
- **Obiettivo**: validare il flusso in ordine L0 poi L1, e infine la semantica end-to-end minima.
- **Responsabilita**:
  1. eseguire prima i test L0 del dominio;
  2. poi i test L1 API pertinenti;
  3. infine verificare che il backoffice rimuova il volontario dalla sezione `Rifiutata` e che il volontario torni candidabile.
- **Dipendenze**: richiede il completamento dei subagent 1, 2 e 3.

## Sequenza operativa

1. **Subagent 1** implementa il comportamento dominio e i test L0.
2. **Subagent 2** costruisce l'adapter REST e i test L1 sopra il contratto del dominio.
3. **Subagent 3** collega il backoffice web al nuovo seam REST.
4. **Subagent 4** esegue la verifica finale in ordine L0 -> L1 -> check funzionale.

## Implementazione prevista

1. **Fase 1, backend domain**: aggiungere in `C:\dev\volontiamo\src\volontiamo.domain\EventService.cs` un metodo dedicato, ad esempio `UndoRejectCandidateAsync(int eventId, Guid userId, CancellationToken ct = default)`, che dipende da `GetSelectableEventAsync`, legge la partecipazione con `GetParticipationAsync`, accetta solo lo stato `EventParticipationStatus.Rifiutata`, chiama `RemoveParticipationAsync`, poi `SaveChangesAsync`, e restituisce `Result<bool>.Success(true)`.
2. **Fase 1, vincoli dominio**: mantenere la stessa guardia di selezionabilita gia usata da `RejectCandidateAsync` e `AcceptCandidateAsync`, cosi l'annullamento del rifiuto resta disponibile solo per eventi attivi/selezionabili. *depends on 1*
3. **Fase 1, L0**: estendere `C:\dev\volontiamo\src\volontiamo.domain.test.L0\EventServiceTests.cs` con test per i casi `Rifiutata -> remove row -> success`, `missing participation -> conflict`, `status diversa da Rifiutata -> conflict`, e facoltativamente `evento non selezionabile -> conflict`. *parallel with 1 once method shape is chosen*
4. **Fase 2, API**: registrare in `C:\dev\volontiamo\src\volontiamo.api\Events\EventEndpoints.cs` una nuova route backoffice `DELETE /api/v1/events/{eventId}/candidates/{userId}/reject` con auth `UserType.Lilt`, handler simile a `RejectCandidate`, risposta `204 NoContent` su successo, `404` se evento inesistente, `409` se la partecipazione non e rifiutata o non esiste. *depends on 1*
5. **Fase 2, L1**: estendere `C:\dev\volontiamo\src\volontiamo.api.tests.L1\EventsEndpointTests.cs` con un test end-to-end che semina una partecipazione `Rifiutata`, invoca la nuova `DELETE`, poi verifica che il dettaglio evento non riporti piu il volontario in `RifiutataParticipants` e che la vista volontario `GET /api/v1/events/my?view=available` esponga lo stesso evento con `ParticipationStatus = null`. Aggiungere anche almeno un test negativo per `missing participation` o `wrong state`. *depends on 4; parallel with 3 after route contract is fixed*
6. **Fase 3, web adapter**: aggiungere in `C:\dev\volontiamo\src\volontiamo.web\volontiamo\lib\events\http-events-adapter.ts` una funzione `undoRejectCandidate(eventId, userId)` che invoca la nuova route `DELETE`, replica la gestione token/network/http di `rejectCandidate`, e usa messaggi specifici per l'errore di annullamento rifiuto. *depends on 4*
7. **Fase 3, server actions**: aggiungere in `C:\dev\volontiamo\src\volontiamo.web\volontiamo\app\events\actions.ts` una `undoRejectCandidateAction(eventId, userId)` che richiama l'adapter, poi `revalidatePath(`/events/${eventId}`)` e `revalidatePath("/events")`, quindi `redirect` alla pagina evento come gia fanno `acceptCandidateAction` e `rejectCandidateAction`. *depends on 6*
8. **Fase 3, UI dettaglio evento**: in `C:\dev\volontiamo\src\volontiamo.web\volontiamo\app\events\[id]\page.tsx` passare una prop `actions` anche alla sezione `Rifiutata`, con form server-action e bottone `Annulla rifiuto`, riusando il pattern esistente usato nella sezione `Candidata`. *depends on 7*
9. **Fase 4, rifinitura UX**: mostrare il bottone solo in `Rifiutata`; lasciare `Partecipa` e `NonInteressata` read-only in questa iterazione. *depends on 8*
10. **Fase 4, verifica finale**: eseguire i test pertinenti in ordine L0 poi L1, quindi una verifica funzionale minima del flusso. *depends on 3, 5, 8*

## Relevant files

- `C:\dev\volontiamo\src\volontiamo.domain\EventService.cs` - seam principale del comportamento.
- `C:\dev\volontiamo\src\volontiamo.domain\IEventRepository.cs` - confermare il riuso di `RemoveParticipationAsync`.
- `C:\dev\volontiamo\src\volontiamo.api\Persistence\EventRepository.cs` - nessuna modifica prevista, ma parte del read model risultante.
- `C:\dev\volontiamo\src\volontiamo.api\Events\EventEndpoints.cs` - nuovo endpoint backoffice.
- `C:\dev\volontiamo\src\volontiamo.domain.test.L0\EventServiceTests.cs` - copertura L0 del nuovo metodo.
- `C:\dev\volontiamo\src\volontiamo.api.tests.L1\EventsEndpointTests.cs` - copertura L1 endpoint/read model.
- `C:\dev\volontiamo\src\volontiamo.web\volontiamo\lib\events\http-events-adapter.ts` - adapter HTTP web.
- `C:\dev\volontiamo\src\volontiamo.web\volontiamo\app\events\actions.ts` - server action.
- `C:\dev\volontiamo\src\volontiamo.web\volontiamo\app\events\[id]\page.tsx` - wiring UI nella sezione `Rifiutata`.

## Decisions

- Incluso: solo annullamento del rifiuto tramite cancellazione della riga `event_participations`.
- Escluso: trasformare `Rifiutata` in `Candidata`, introdurre audit/history, cambiare schema DB, aggiungere nuove tabelle o soft-delete.
- Route raccomandata: `DELETE /api/v1/events/{eventId}/candidates/{userId}/reject`, per minimizzare il delta e mantenere simmetria con la route di reject esistente.
- Risposta raccomandata: `204 NoContent`, coerente con le altre azioni backoffice.
- Nessun intervento su `volontiamo.mobile`: il client volontario beneficia indirettamente del read model pulito ma non richiede modifiche.
