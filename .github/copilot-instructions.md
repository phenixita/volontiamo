## Stile architetturale API

- Monolite modulare
- volontiamo.api è solo per esporre endpoint REST, non deve contenere logica di business
- volontiamo.domain contiene dominio applicativo, entità, logica di business e regole di validazione...
- volontiamo.mobile è un client mobile React Native DEDICATO IN MODO ESCLUSIVO AL VOLONTARIO
- volontiamo.web è un client web dedicato alla gestione di backoffice e amministrazione dedicato al personale LILT
- Hai a disposizione Docker
- Preferisci il livello di test più basso possibile: L0 prima di L1.
- Nei test L0 usa implementazioni dedicate in memoria al posto di mocking e stub quando serve attraversare un seam.
- Per il workflow operativo TDD del repository usa la skill `volontiamo-tdd-guard`.
