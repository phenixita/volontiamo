## Interview: Event participation states

Introdurre un workflow esplicito per la partecipazione agli eventi attivi: il volontario vede gli eventi `Active` su mobile anche senza partecipazione preesistente, puo` impostare `Candidata` oppure `NonInteressata`, il backoffice web vede e gestisce le candidature con transizioni `Candidata -> Partecipa` o `Candidata -> Rifiutata`, e `Partecipa` e` finale per questo intervento.

**Steps**
1. **Phase 1 - Deepening the domain seam**
   1. Aggiornare `EventParticipationStatus` in `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.domain\Event.cs` introducendo gli stati PascalCase italiani `Candidata`, `Partecipa`, `Rifiutata`, `NonInteressata`, e rimuovendo il significato attuale di `Accepted`/`Refused`. *Blocks all later steps.*
   2. Ridisegnare i DTO in `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.domain\EventService.cs` per separare i conteggi/listati usati dal web: almeno conteggi `Candidata` e `Partecipa` in lista eventi, e liste separate `Candidata`, `Partecipa`, `NonInteressata`, `Rifiutata` nel dettaglio evento. *Depends on step 1.*
   3. Rafforzare la logica di dominio in `EventService` con transizioni ammesse e autori ammessi: mobile puo` fare `null -> Candidata`, `null -> NonInteressata`, `NonInteressata -> null`; web puo` fare `Candidata -> Partecipa` e `Candidata -> Rifiutata`; `Partecipa` e `Rifiutata` sono finali per questo intervento. Evitare transizioni implicite o ambigue. *Depends on step 1.*
2. **Phase 2 - API adapter alignment**
   1. Aggiornare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.api\Events\EventEndpoints.cs` per accettare i nuovi stati PascalCase nel parsing, sostituire i messaggi di validazione, e separare gli endpoint mobile dai comandi gestionali web. *Depends on Phase 1.*
   2. Introdurre endpoint espliciti per le azioni di backoffice sulle candidature, invece di riusare il vecchio flusso “accepted/refused”, cosi` il seam HTTP resta piccolo e il significato delle transizioni resta chiaro. *Depends on previous step.*
   3. Verificare che `/events/my` continui a servire il mobile ma con semantica aggiornata: lista principale di eventi `Active` rilevanti e filtro dedicato per `NonInteressata`. *Parallel with web/mobile contract updates once domain shape is fixed.*
3. **Phase 3 - Mobile volunteer workflow**
   1. Aggiornare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\lib\types.ts` e `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\lib\api.ts` per i nuovi status, il parsing dei payload e il nuovo significato delle viste elenco. *Depends on Phase 2 contracts.*
   2. Modificare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\app\(drawer)\events\index.tsx` per mostrare gli eventi `Active` anche senza partecipazione, lasciare le due azioni `Candidati` e `Non interessata`, nascondere `NonInteressata` dalla vista principale, e aggiungere il filtro/vista dedicata per recuperare gli eventi esclusi con azione “Torna disponibile”. *Depends on previous step.*
   3. Aggiornare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\app\(drawer)\events\[id].tsx` per etichette stato coerenti: `Candidata`, `Partecipa`, `Rifiutata`, `NonInteressata` o nessuna risposta. *Parallel with list screen once types are updated.*
4. **Phase 4 - Web backoffice workflow**
   1. Aggiornare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\lib\events\contracts.ts` e `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\lib\events\http-events-adapter.ts` per i nuovi contratti di lista/dettaglio e per i nuovi comandi di gestione candidatura. *Depends on Phase 2.*
   2. Modificare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\app\events\page.tsx` per mostrare in lista due conteggi separati: `Candidata` e `Partecipa`. `NonInteressata` e `Rifiutata` restano fuori dalla lista e visibili solo nel dettaglio evento. *Depends on previous step.*
   3. Modificare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\app\events\[id]\page.tsx` per aggiungere quattro sezioni distinte (`Candidata`, `Partecipa`, `NonInteressata`, `Rifiutata`) e azioni operative solo sulle `Candidata`: `Accetta` e `Rifiuta`. *Depends on previous step.*
   4. Aggiornare `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\app\events\actions.ts` per introdurre server actions dedicate alle transizioni di candidatura e revalidation delle pagine coinvolte. *Parallel with step 3 once adapter methods exist.*
5. **Phase 5 - Replace-don't-layer verification**
   1. Aggiungere/aggiornare prima i test L0 in memoria del dominio per i nuovi stati, le transizioni consentite e i filtri di elenco, senza mocking library. *Start before production changes where practical; blocks completion.*
   2. Aggiornare i test L1 esistenti dell’API/repository solo dove necessari a coprire serializzazione, query e shape dei payload. *Depends on stable domain/API behaviour.*
   3. Eseguire baseline e post-change dei test pertinenti in ordine L0 poi L1, e infine validare manualmente il giro completo: evento `Active` visibile su mobile, candidatura da mobile, gestione candidatura su web, ritorno stato corretto su mobile/web. *Final gate.*

**Relevant files**
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.domain\Event.cs` — enum `EventParticipationStatus` e modello `EventParticipation`, seam principale del dominio.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.domain\EventService.cs` — metodi `ListAsync`, `GetDetailAsync`, `ListParticipantEventsAsync`, `SetParticipationAsync`, `RemoveParticipantAsync`; oggi contengono il vecchio workflow e vanno ridisegnati.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.api\Events\EventEndpoints.cs` — parsing query/status, endpoint `/my`, `/{id}/participation`, delete participant; adapter HTTP da riallineare.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\lib\types.ts` — unione `ParticipationStatus` e `ParticipantEventListView`.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\lib\api.ts` — `mapParticipationStatus`, `fetchMyEvents`, `setEventParticipation`, mapping dei payload partecipazione.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\app\(drawer)\events\index.tsx` — lista eventi volontario, toggle/filtro, CTA di stato.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.mobile\volontiamo\app\(drawer)\events\[id].tsx` — testo dello stato partecipazione nel dettaglio mobile.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\lib\events\contracts.ts` — DTO di lista/dettaglio e contratti di mutazione lato web.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\lib\events\http-events-adapter.ts` — validazione payload e metodi HTTP lato web.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\app\events\page.tsx` — tabella eventi con conteggi da separare.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\app\events\[id]\page.tsx` — dettaglio evento con le quattro sezioni partecipazione.
- `C:\dev\volontiamo.worktrees\agents-event-participation-status-update-adc0d5a1\src\volontiamo.web\volontiamo\app\events\actions.ts` — server actions da adattare alle nuove transizioni.

**Verification**
1. Individuare ed eseguire i test esistenti del dominio eventi prima delle modifiche per avere baseline L0.
2. Scrivere/aggiornare test L0 in memoria per: visibilita` eventi `Active` senza partecipazione; filtro `NonInteressata`; transizioni consentite e rifiuto di transizioni illegali; finalita` di `Partecipa` e `Rifiutata`.
3. Eseguire i test API/infrastruttura esistenti che coprono query partecipazioni e dettaglio evento per verificare conteggi e liste separate.
4. Eseguire i test pertinenti del mobile/web gia` presenti nel repository, senza introdurre nuovi tool di build/lint/test.
5. Verificare manualmente il giro end-to-end: creare evento `Active`, visualizzarlo su mobile, impostare `Candidata`, vedere la candidatura su web, eseguire `Accetta` o `Rifiuta`, e ricontrollare il rendering corretto su mobile/web; verificare anche `NonInteressata` -> filtro dedicato -> `Torna disponibile`.

**Decisions**
- Stati di dominio in PascalCase italiano: `Candidata`, `Partecipa`, `Rifiutata`, `NonInteressata`.
- Nessuna compatibilita` o migrazione dati: il database verra` ripulito manualmente.
- `Partecipa` e` finale per questo intervento.
- `Rifiutata` e` esito del backoffice, definitivo per quell’evento.
- `NonInteressata` e` una scelta del volontario, reversibile da filtro dedicato mobile.
- Solo il mobile puo` impostare o rimuovere `NonInteressata`.
- Il web puo` agire solo sulle `Candidata` con `Accetta`/`Rifiuta`.
- Lista eventi web: mostra solo conteggi `Candidata` e `Partecipa`; dettaglio web: quattro sezioni separate.
- Scope incluso: domain + api + mobile + web per il workflow completo degli stati partecipazione evento.
- Scope escluso: migrazioni dati legacy, ulteriori transizioni dopo `Partecipa`, workflow diversi da evento `Active`, e nuove capability non richieste di backoffice su `NonInteressata`.
