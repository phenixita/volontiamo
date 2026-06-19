# volontiamo.web

Frontend Next.js (App Router) per Volontiamo.

## Prerequisiti

- Node.js 20+
- API locale avviata (progetto volontiamo.api)

## Configurazione ambiente

1. Copia `.env.example` in `.env.local`.
2. Imposta `VOLONTIAMO_API_BASE_URL` con il base URL del backend API.

Esempio locale:

```env
VOLONTIAMO_API_BASE_URL=http://localhost:5187
```

La route `/users` legge sempre questa variabile lato server.

## Avvio

```bash
npm install
npm run dev
```

## Verifica

```bash
npm run lint
npm run build
```

## Route principali

- `/` shell introduttiva con navigazione.
- `/users` lettura paginata da `GET /api/v1/users?page={page}&pageSize={pageSize}` con stati:
	- loading route transition
	- errore leggibile
	- empty state
