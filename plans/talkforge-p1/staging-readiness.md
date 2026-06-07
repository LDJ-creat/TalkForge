# P1 Real-Provider Staging Readiness

This checklist verifies the complete TalkForge P1 learning loop with **real providers** in a staging-like environment. It complements the operational checks in [`ops-verification.md`](./ops-verification.md).

## CI vs Manual Verification

| Check | Where it runs | Notes |
|-------|---------------|-------|
| Full learning loop with mocked providers | `npm run test -- src/test/p1-e2e-staging-readiness.test.ts` | Safe for CI; validates job wiring and AI trace operations |
| Infrastructure connectivity | `npm run infra:check` | PostgreSQL + Redis |
| Staging smoke summary | `npm run staging:smoke` | Prints provider/config status and next manual steps |
| Real-provider end-to-end flow | Manual checklist below | Requires paid API keys and object storage |

## Prerequisites

1. Node.js 20+
2. Docker Compose for PostgreSQL and Redis (recommended)
3. `ffmpeg` on the worker host (required for Paraformer ASR and iFlytek ISE audio prep)
4. Real provider credentials in `.env` (never commit secrets)

### Recommended demo scenario

Use the seeded **Order Coffee at a Cafe** scenario (`coffee_ordering_a2`):

```bash
npm run db:seed
```

The seed upserts built-in scenarios and the dev user (`99999999-9999-4999-8999-999999999999`).

## Environment Setup

Copy `.env.example` to `.env`, then enable real infrastructure and providers.

### Core runtime

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/talkforge
QUEUE_PROVIDER=redis
REDIS_URL=redis://localhost:6381
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_DEV_USER_ID=99999999-9999-4999-8999-999999999999
```

### Object storage (required for real audio)

```env
STORAGE_PROVIDER=oss
STORAGE_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
STORAGE_BUCKET=talkforge-audio-staging
STORAGE_ACCESS_KEY_ID=<server-only>
STORAGE_SECRET_ACCESS_KEY=<server-only>
STORAGE_REGION=oss-cn-hangzhou
STORAGE_SIGNING_SECRET=<random-hmac-secret>
```

### Realtime voice

```env
REALTIME_PROVIDER=qwen-omni
REALTIME_API_KEY=<server-only>
REALTIME_BASE_URL=https://dashscope.aliyuncs.com
REALTIME_MODEL=qwen3-omni-flash-realtime
REALTIME_VOICE=Cherry
REALTIME_PROXY_PORT=3002
NEXT_PUBLIC_REALTIME_PROXY_URL=ws://localhost:3002
```

### ASR

```env
ASR_PROVIDER=paraformer
ASR_API_KEY=<server-only>
ASR_BASE_URL=https://dashscope.aliyuncs.com
ASR_MODEL=paraformer-realtime-8k-v2
```

### Text LLM (correction, report, scenario judge)

```env
LLM_CORRECTION_PROVIDER=dashscope
LLM_REPORT_PROVIDER=dashscope
LLM_GOAL_JUDGE_PROVIDER=dashscope
LLM_API_KEY=<server-only>
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
```

### TTS (standard Shadowing audio)

```env
TTS_PROVIDER=cosyvoice
TTS_API_KEY=<server-only>
TTS_BASE_URL=https://dashscope.aliyuncs.com
TTS_MODEL=cosyvoice-v3-flash
TTS_VOICE=longxiaochun_v3
```

### Pronunciation evaluation (Shadowing only)

```env
PRONUNCIATION_PROVIDER=iflytek-ise
PRONUNCIATION_APP_ID=<server-only>
PRONUNCIATION_API_KEY=<server-only>
PRONUNCIATION_API_SECRET=<server-only>
```

### AI invocation tracing

```env
AI_TRACING_ENABLED=true
AI_TRACING_RAW_REQUEST=true
AI_TRACING_RAW_RESPONSE=true
AI_TRACING_RAW_STORAGE=file
AI_TRACING_SAMPLE_RATE=1
AI_TRACING_LOCAL_ROOT=.storage/ai-traces
```

### Operational health detail (staging)

```env
OPS_HEALTH_DETAIL_TOKEN=<random-token>
```

## Boot Sequence

```bash
npm install
npm run infra:up
npm run infra:check
npm run db:push
npm run db:seed
npm run staging:smoke
```

Run in **two terminals**:

```bash
npm run dev
npm run worker
```

When `REALTIME_PROVIDER=qwen-omni`, the worker also starts the local realtime WebSocket proxy on `REALTIME_PROXY_PORT` (default `3002`). The browser connects to `NEXT_PUBLIC_REALTIME_PROXY_URL` because DashScope requires `Authorization` headers that browser WebSockets cannot send directly.

If you are testing voice without the Redis worker, run `npm run realtime-proxy` in a separate terminal instead.

Confirm `GET /api/health` returns `200`.

## Manual Staging Checklist

Work through these steps in order. Record the `sessionId` from step 2 for trace inspection in step 11.

### 1. Scenario selection

- [ ] Open [http://localhost:3000](http://localhost:3000)
- [ ] Select **Order Coffee at a Cafe**
- [ ] Confirm the scenario card loads without API errors

### 2. Realtime voice session (bidirectional PCM)

- [ ] Session connects with real realtime credentials (not client-only fallback)
- [ ] Browser receives only ephemeral token + WebSocket endpoint (no long-lived API key in network tab)
- [ ] Realtime proxy is reachable (`ws://localhost:3002/realtime?model=...`)
- [ ] **AI speaks first** after `session.updated` (opening via `response.create`, not a local mock transcript)
- [ ] Status bar shows `AI is speaking`, then returns to `Listening`
- [ ] Speak at least one short English utterance; assistant replies with audible voice
- [ ] User and assistant turns appear in the transcript panel as realtime events arrive
- [ ] **Send practice response** button is hidden during live voice mode (only visible in text fallback)
- [ ] If microphone is unavailable, use **Continue with text practice** fallback instead

### 3. User-turn audio upload

- [ ] Complete at least one user turn with audio attached
- [ ] `audio_segments` row exists for the turn
- [ ] Object exists in private storage at the persisted `object_key`

### 4. ASR transcript

- [ ] Worker logs show `asr.transcribe` job success
- [ ] `transcripts` row exists with non-empty `text`
- [ ] UI transcript panel refreshes after background jobs finish

### 5. Correction generation

- [ ] `corrections` rows exist for the user turn (or `asr_uncertain` when confidence is low)
- [ ] Worker logs show `correction.analyze` success

### 6. Scenario progress update

- [ ] `scenario_progress.completed_goal_ids` updates after user speech
- [ ] Progress API (`GET /api/sessions/:id/progress`) reflects completed/missing goals
- [ ] UI progress banner updates when goals complete

### 7. Session ending

- [ ] Click **End practice**
- [ ] `sessions.status` becomes `completed`
- [ ] Report job is enqueued (`report.generate`)

### 8. Report generation

- [ ] Worker processes `report.generate`
- [ ] `reports` row contains summary, task completion, and next practice suggestion
- [ ] Session report panel renders in the UI

### 9. Standard audio generation

- [ ] Worker processes `shadowing.generate` after report completion
- [ ] `shadowing_items` rows exist with `standard_audio_status = ready`
- [ ] Standard audio objects exist in private storage under `tts/`

### 10. Shadowing pronunciation evaluation

- [ ] Open Shadowing section for the completed session
- [ ] Record or upload a short practice clip for a recommended sentence
- [ ] Worker processes `evaluation.shadowing`
- [ ] Shadowing evaluation scores appear in the UI

### 11. AI invocation trace verification

With `AI_TRACING_ENABLED=true`:

```bash
# Replace SESSION_ID and token from your completed session
curl -s "http://localhost:3000/api/health?detail=1" \
  -H "Authorization: Bearer $OPS_HEALTH_DETAIL_TOKEN" | jq .

npm run staging:smoke -- --session-id <SESSION_ID>
```

Confirm `ai_invocation_logs` contains rows for the session with these operations:

| Operation | Provider category |
|-----------|-------------------|
| `realtime.session.create` | Realtime |
| `asr.transcribe` | ASR |
| `llm.correction` | Text LLM |
| `llm.scenarioJudge` | Text LLM |
| `llm.report` | Text LLM |
| `tts.generate` | TTS |
| `pronunciation.evaluate` | Pronunciation (free speech + shadowing) |

Also verify:

- [ ] Raw trace files appear under `AI_TRACING_LOCAL_ROOT` when raw capture is enabled
- [ ] Trace summaries contain no API keys, auth headers, or raw audio bytes
- [ ] `GET /api/health?detail=1` shows increasing `aiInvocations.totalCalls`

See [`ops-verification.md`](./ops-verification.md) for provider health, usage limits, and failure fallback checks.

## Expected Data Flow

```text
Scenario select
  -> POST /api/sessions (realtime.session.create trace)
  -> realtime conversation
  -> POST /api/sessions/:id/turns + audio finalize
  -> asr.transcribe
  -> correction.analyze + evaluation.freeSpeech + scenario.progress.evaluate
  -> POST complete session
  -> report.generate -> shadowing.generate (tts.generate)
  -> shadowing evaluate API -> evaluation.shadowing (pronunciation.evaluate)
```

## Known Limitations

- **Authentication:** Dev header auth (`x-talkforge-user-id`) is not production-ready.
- **Doubao realtime:** Not implemented; only `mock` and `qwen-omni` are supported today.
- **Free-conversation pronunciation:** Stays lightweight even when `iflytek-ise` is configured; phoneme-level scoring is Shadowing-only.
- **Paraformer input format:** Requires mono PCM 8 kHz; worker converts uploaded webm/wav via `ffmpeg`.
- **iFlytek ISE input format:** Requires mono PCM 16 kHz; worker converts via `ffmpeg`.
- **Redis worker required:** With `QUEUE_PROVIDER=redis`, background jobs do not run unless `npm run worker` is active.
- **Cost controls:** Tight `SESSION_MAX_*` limits are recommended for smoke tests; reset before inviting real users.
- **Raw trace retention:** `AI_TRACING_RETENTION_DAYS` is a hint only; automated cleanup is a future task.

## Follow-Up (Out of P1 Scope)

- Production authentication and authorization
- Doubao realtime provider
- Self-hosted faster-whisper ASR worker
- Automated raw-trace retention job
- Teacher/admin dashboards
