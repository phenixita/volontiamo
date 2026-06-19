## Users Read Flow — Implementation Plan

Prima integrazione dati reale in volontiamo.web: introdurre una pagina dedicata `/users` che legge `GET /api/v1/users` dal backend configurato via variabile d'ambiente, renderizza server-side una lista paginata base e lascia la home `/` come shell introduttiva con navigazione reale verso la nuova route. Approccio raccomandato: un piccolo adapter HTTP lato server, tipi frontend allineati al contratto API esistente e pagina App Router server-rendered con stati success/error/empty ben definiti.

### Steps

1. Fissare il contratto frontend da riusare: mappare il payload paginato dell'API (`items`, `page`, `pageSize`, `totalCount`) e il DTO utente esposto oggi dal backend. Riferimento principale: `UserEndpoints.ListUsers` e `UserService.ListAsync`. Questo definisce l'interfaccia del modulo web e blocca i passi successivi.
2. Introdurre la configurazione del backend per il frontend Next tramite env dedicata, evitando URL hardcoded. La configurazione deve rendere esplicito il base URL usato dal server render di Next. *depends on 1*
3. Creare un adapter HTTP server-side piccolo e testabile che costruisce la request a `GET /api/v1/users?page={page}&pageSize={pageSize}`, valida la base URL, gestisce errori HTTP/non-HTTP e restituisce un risultato utile al chiamante. Questo e il seam principale lato web. *depends on 1, 2*
4. Creare la route App Router dedicata `/users` come Server Component che legge i parametri di query per la paginazione, invoca l'adapter HTTP e renderizza la prima lista reale. La pagina deve mostrare le colonne confermate: nome completo, email, telefono, stato attivo, tipo utente. *depends on 3*
5. Aggiungere i tre stati UX minimi nella pagina `/users`: empty state, errore leggibile e loading del route transition secondo pattern App Router correnti. L'errore deve aiutare a distinguere tra assenza dati e backend non raggiungibile. *depends on 4*
6. Collegare la shell esistente alla nuova feature: aggiornare header/sidebar/mobile drawer per puntare davvero a `/users`, mantenendo `/` come shell introduttiva senza redirect. *parallel with 5 after 4*
7. Rifinire la presentazione dei dati nella tabella/lista per coerenza con il design attuale: formato nome composto, fallback per telefono mancante, badge attivo/inattivo, label leggibile per `UserType`. *depends on 4*
8. Verificare il flusso a livello piu basso utile nel frontend: testare almeno l'adapter HTTP in isolamento se il setup del progetto lo consente; in ogni caso eseguire lint e build del frontend e una verifica manuale con API locale attiva. *depends on 3, 4, 5, 6, 7*

### Relevant files

- `src/volontiamo.api/Users/UserEndpoints.cs` — contratto HTTP reale, in particolare `ListUsers` con query `page` e `pageSize`.
- `src/volontiamo.domain/UserService.cs` — DTO `UserResponse`, clamp di paginazione e mapping dominio->payload.
- `src/volontiamo.domain/PagedResponse.cs` — response envelope da rispecchiare lato frontend.
- `src/volontiamo.api.tests.L1/UsersEndpointTests.cs` — riferimento comportamentale dell'endpoint paginato gia verificato in backend.
- `src/volontiamo.web/volontiamo/app/page.tsx` — shell esistente da mantenere, aggiornando la navigazione verso `/users`.
- `src/volontiamo.web/volontiamo/app/` — directory sotto cui introdurre la nuova route `/users` e i file App Router associati (`page`, `loading`, eventuale `error`).
- `src/volontiamo.web/volontiamo/package.json` — script di verifica disponibili (`lint`, `build`).
- `src/volontiamo.web/volontiamo/` — root frontend in cui aggiungere configurazione env e il modulo adapter/tipi condivisi del client API.

### Verification

1. Avviare l'API locale dal workspace root con `dotnet run --project .\src\volontiamo.api\volontiamo.api.csproj` e verificare che `GET /api/v1/users` risponda con envelope paginato.
2. Eseguire la verifica piu stretta sul modulo HTTP frontend disponibile nel repo; se non esiste ancora una harness test frontend, documentare esplicitamente questo gap e non inventare una suite ampia solo per questa feature.
3. Eseguire `npm run lint` in `src/volontiamo.web/volontiamo`.
4. Eseguire `npm run build` nello stesso path per validare App Router, tipizzazione e uso env lato server.
5. Verifica manuale con frontend e API in locale: aprire `/users`, controllare caricamento prima pagina, badge stato, label tipo utente, fallback dati mancanti e navigazione dalla shell `/`.
6. Verifica manuale errore configurazione: provare base URL assente o backend spento e controllare che la pagina mostri uno stato errore leggibile invece di fallire in modo opaco.

### Decisions

- **Inclusi**: route dedicata `/users`, fetch server-side iniziale, base URL backend via env, lista paginata base, colonne nome/email/telefono/stato/tipo, navigazione reale dalla shell esistente.
- **Esclusi**: creazione/modifica/cancellazione utenti, dettaglio utente, filtri o ricerca, autenticazione, caching avanzato, redirect della home, redesign profondo della shell.
- **Decisione confermata**: la home `/` resta una shell introduttiva e non diventa la pagina dati primaria.
- **Decisione confermata**: la prima vertical slice frontend usa il contratto backend esistente senza cambiare l'API.
- **Decisione confermata**: il seam principale lato web e un adapter HTTP server-side dedicato, non fetch sparsi direttamente nel JSX.
