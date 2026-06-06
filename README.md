# TalkForge

Web-based AI English speaking practice with realtime voice role-play and asynchronous teaching feedback.

P0 runs entirely on **mock providers** — no paid API keys required.

## Prerequisites

- Node.js 20+
- PostgreSQL (local)

## Quick start

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run db:seed` is recommended but no longer strictly required for the built-in scenarios: starting a session will auto-create the dev user and upsert seed scenarios when possible.

## Environment

Copy `.env.example` to `.env` and adjust if needed:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_BASE_URL` | Server base URL for signed upload links |
| `NEXT_PUBLIC_APP_BASE_URL` | Browser base URL for audio upload handoff |
| `NEXT_PUBLIC_DEV_USER_ID` | Dev user id sent as `x-talkforge-user-id` from the UI |
| `STORAGE_PROVIDER` | `mock` for local development |
| `STORAGE_SIGNING_SECRET` | HMAC secret for mock upload tokens |

Provider overrides (`ASR_PROVIDER`, `REALTIME_PROVIDER`, etc.) default to `mock`.

### Security note (P0 dev only)

Authentication is a development header (`x-talkforge-user-id` / `NEXT_PUBLIC_DEV_USER_ID`). Any client can impersonate any user id. This is **not production-ready** and must be replaced before a real deployment.

### Queue note

Leave `REDIS_URL` unset for local P0 demos. The app processes mock background jobs in-process via a memory queue. If you set `REDIS_URL`, you must also run a BullMQ worker process or jobs will enqueue but never execute, and reports will stay unavailable.

## P0 mock demo flow (manual verification)

1. Start the app (`npm run dev`) with PostgreSQL reachable.
2. On the home page, pick a scenario (e.g. **Order Coffee at a Cafe**).
3. Wait for the session to connect — the backend creates a DB session and mock realtime credentials.
4. Click **Send practice response** one or more times. Each click:
   - Creates user/assistant turns in PostgreSQL
   - Uploads mock audio through the storage handoff (P0 uses a simulated turn button, not browser `MediaRecorder`)
   - Runs background jobs in-process (ASR → correction → evaluation → scenario progress)
   - Refreshes transcripts from the server after jobs finish
5. Click **End practice**. The session completes and a report job runs.
6. Confirm the **Session report** panel shows summary, task completion, and next practice suggestion.

### Expected data connections

| Step | Data created/updated |
|------|----------------------|
| Session start | `sessions`, `scenario_progress`, mock realtime credentials |
| Practice turn | `turns`, `audio_segments`, ASR `transcripts` |
| Background jobs | `corrections`, `pronunciation_evaluations`, updated `scenario_progress` |
| End session | `sessions.status = completed`, `reports` |

### Troubleshooting

- **Session falls back to client-only mock** — Check `DATABASE_URL`, set `NEXT_PUBLIC_DEV_USER_ID`, and confirm PostgreSQL is running. Server errors (5xx) also fall back to the client mock shell.
- **Report unavailable** — Confirm PostgreSQL is running, leave `REDIS_URL` unset, and check server logs for `[talkforge:job]` entries.
- **401 on API calls** — Set `NEXT_PUBLIC_DEV_USER_ID` to match the seeded dev user (`99999999-9999-4999-8999-999999999999` by default).
- **Practice button missing** — The session did not link to the backend. Fix database connectivity or env vars above.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run test` | Run Vitest suite |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply Drizzle schema |
| `npm run db:seed` | Seed dev user + built-in scenarios |

## Architecture

See `TalkForge-Design.md` and `AGENTS.md` for product and agent guidelines.
