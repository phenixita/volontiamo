# Interview: Basic Authentication POC

Introdurre autenticazione base end-to-end con email e password memorizzate sul record `User`, token Bearer semplice, `POST /login` pubblico, resto delle API autenticato, ruolo `UserType` solo informativo (`Lilt` o `Volontario`) senza autorizzazioni differenziate. Bootstrap con seed development iniziale; gestione utenti e password iniziale anche da web app; mobile e web devono mostrare l'utente autenticato e il suo tipo.

## Steps

1. Phase 1 - Domain contract and tests [done]
2. Estendere `User` per contenere i dati minimi di autenticazione nel dominio: identificativo di login = `Email`, hash password, eventuale stato coerente con `IsActive`; mantenere `UserType` invariato come enum a 2 valori. [done] *Blocca 3-8*
3. Estendere i contratti di dominio in `UserService` per supportare creazione utente con password iniziale e lettura del profilo senza esporre hash password; aggiungere un modulo dedicato all'autenticazione (`Authenticate`, `GetCurrentUser`) con interfaccia piccola e profonda. [done] *Blocca 4-8*
4. Scrivere/aggiornare test L0 nel dominio con fake repository in memoria: creazione utente con password, rifiuto credenziali errate, rifiuto utente inattivo, successo login con ritorno identità corrente. [done] *Dipende da 2-3*
5. Phase 2 - Persistence and API seam [done]
6. Estendere persistence EF Core per mappare i nuovi campi auth su `User`, aggiungere migration e allineare repository esistenti affinché leggano/scrivano i campi necessari. [done] *Dipende da 2-3; parallel con 7 solo parzialmente dopo i contratti*
7. Introdurre nell'API la configurazione auth Bearer semplice e un servizio token dedicato; aggiungere `POST /api/v1/auth/login` pubblico e `GET /api/v1/auth/me` autenticato; applicare autenticazione obbligatoria a `users` ed `events`. [done] *Dipende da 3; blocca 8-10*
8. Aggiungere bootstrap development coerente: seed di un utente iniziale `Lilt` noto tramite startup development, così `POST /users` può restare protetto e Postman può essere usato dopo login. [done] *Dipende da 6-7*
9. Estendere `POST /api/v1/users` e `PUT /api/v1/users/{id}` per gestire la password iniziale/aggiornamento minimo richiesto dalla POC senza introdurre reset/forgot password. [done] *Dipende da 3,6,7*
10. Scrivere/aggiornare test L1 API per login, `/me`, protezione degli endpoint esistenti, seed development e creazione utente con password. [done] *Dipende da 6-9*
11. Phase 3 - Web authenticated flow
12. Introdurre nel frontend Next.js un adapter auth HTTP dedicato, con storage della sessione Bearer sul lato appropriato dell'app, bootstrap dell'utente corrente via `/me`, e propagazione del token alle chiamate `users` ed `events`. [done] *Dipende da 7; blocca 13-14*
13. Aggiungere schermata/login flow web, proteggere il shell esistente e mostrare utente corrente + `UserType` in un punto stabile dell'interfaccia. [done] *Dipende da 12*
14. Estendere la UI di gestione utenti web per impostare la password iniziale in creazione/modifica secondo il perimetro deciso. [done] *Dipende da 9,12; parallel con 13 dopo 12*
15. Phase 4 - Mobile authenticated flow
16. Introdurre nel client Expo un piccolo modulo auth per login, persistenza token locale, bootstrap dell'utente corrente via `/me`, e invio header Bearer nelle chiamate API esistenti. *Dipende da 7; blocca 17*
17. Inserire una schermata/login gate iniziale al posto del redirect diretto agli eventi e mostrare nome/email/tipo dell'utente autenticato in drawer o schermata profilo minimale. *Dipende da 16*
18. Phase 5 - Verification and manual walkthrough
19. Validare in ordine: test L0 dominio, test L1 API, smoke test manuale web, smoke test manuale mobile, prova Postman con seed login -> create user -> login nuovo utente -> `/me`. *Dipende da 4,10,13-17*

## Relevant files

- `c:\dev\volontiamo\src\volontiamo.domain\User.cs` — estendere aggregate `User` con stato credenziali mantenendo il dominio utente come seam principale
- `c:\dev\volontiamo\src\volontiamo.domain\UserService.cs` — riusare pattern `CreateAsync`/`UpdateAsync` e aggiungere contratti senza esporre dettagli persistence
- `c:\dev\volontiamo\src\volontiamo.domain\IUserRepository.cs` — ampliare le query necessarie per lookup autenticazione per email
- `c:\dev\volontiamo\src\volontiamo.domain\Result.cs` — riusare il pattern di successo/errore per login e `/me`
- `c:\dev\volontiamo\src\volontiamo.domain.test.L0\UserServiceTests.cs` — estendere i fake in-memory e coprire autenticazione L0
- `c:\dev\volontiamo\src\volontiamo.api\Program.cs` — aggiungere configurazione authentication/authorization middleware e bootstrap development
- `c:\dev\volontiamo\src\volontiamo.api\Users\UserEndpoints.cs` — proteggere endpoint e aggiornare contratti create/update utente
- `c:\dev\volontiamo\src\volontiamo.api\Events\EventEndpoints.cs` — richiedere utente autenticato
- `c:\dev\volontiamo\src\volontiamo.api\Persistence\AppDbContext.cs` — mappare nuovi campi auth
- `c:\dev\volontiamo\src\volontiamo.api\Persistence\UserRepository.cs` — supportare lookup per email e persistenza credenziali
- `c:\dev\volontiamo\src\volontiamo.api\Persistence\DatabaseStartup.cs` — inserire seed development iniziale
- `c:\dev\volontiamo\src\volontiamo.api\Persistence\Migrations\` — aggiungere migration schema auth
- `c:\dev\volontiamo\src\volontiamo.api.tests.L1\UsersEndpointTests.cs` — aggiornare i test utenti protetti e create user con password
- `c:\dev\volontiamo\src\volontiamo.api.tests.L1\EventsEndpointTests.cs` — verificare protezione degli eventi
- `c:\dev\volontiamo\src\volontiamo.api.tests.L1\PostgresWebApplicationFactory.cs` — supportare configurazione auth e seed nei test
- `c:\dev\volontiamo\src\volontiamo.web\volontiamo\lib\users\http-users-adapter.ts` — aggiungere header auth alle chiamate backend esistenti
- `c:\dev\volontiamo\src\volontiamo.web\volontiamo\lib\events\http-events-adapter.ts` — propagare Bearer token
- `c:\dev\volontiamo\src\volontiamo.web\volontiamo\app\components\app-shell.tsx` — mostrare identità corrente e proteggere accesso shell
- `c:\dev\volontiamo\src\volontiamo.web\volontiamo\lib\` — introdurre adapter auth, contratti sessione e bootstrap current user
- `c:\dev\volontiamo\src\volontiamo.mobile\volontiamo\lib\api.ts` — centralizzare header Bearer e bootstrap `/me`
- `c:\dev\volontiamo\src\volontiamo.mobile\volontiamo\app\index.tsx` — sostituire redirect diretto con gate login/sessione
- `c:\dev\volontiamo\src\volontiamo.mobile\volontiamo\app\` — aggiungere schermata login e punto UI per identità corrente

## Verification

1. Eseguire i test L0 da `c:\dev\volontiamo`: `dotnet test .\src\volontiamo.domain.test.L0\volontiamo.domain.test.L0.csproj`
2. Eseguire i test L1 da `c:\dev\volontiamo`: `dotnet test .\src\volontiamo.api.tests.L1\volontiamo.api.tests.L1.csproj`
3. Avviare l'API in development e verificare con Postman: login dell'utente seed, `GET /api/v1/auth/me`, `GET /api/v1/events` con Bearer, `POST /api/v1/users` con password iniziale e nuovo login con quell'utente
4. Avviare la web app e verificare: redirect a login, login con utente seed, shell caricata, nome/email/tipo visibili, chiamate a `users/events` funzionanti con token
5. Avviare Expo mobile e verificare: login iniziale, persistenza sessione, fetch eventi autenticato, visualizzazione utente corrente e tipo

## Decisions

- Credenziali dentro `User`, non account separato
- Tipi utente in POC: solo `Lilt` e `Volontario`, mutuamente esclusivi
- Identificativo login: `Email`
- Password salvata come hash con primitive standard del framework, non plain text
- Meccanismo sessione: token Bearer semplice condiviso tra API, web e mobile
- Endpoint pubblici: solo login; resto autenticato
- Nessuna autorizzazione differenziata in questa fase: `UserType` solo informativo
- Nessun self-signup, nessun forgot/reset password, nessun OAuth/OIDC esterno
- La password iniziale deve poter essere impostata nella web app di gestione utenti
- Endpoint dedicato `/me` per ottenere l'identità corrente
- Scope incluso: dominio, API, persistence, test L0/L1, login web, login mobile, visualizzazione utente corrente
- Scope escluso: permessi per ruolo, recupero password, MFA, refresh token, provider esterni, auditing sicurezza avanzato

## Rationale

- Tenere l'auth come piccolo modulo dedicato dietro interfacce di dominio evita che `volontiamo.api` assorba logica di business
- Usare `/me` evita di accoppiare web/mobile al formato del token e rende il bootstrap UI più stabile
- Il seed development è il modo più coerente per mantenere protetto `POST /users` senza introdurre eccezioni di bootstrap permanenti
