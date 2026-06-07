# P1-014 Operational Verification

Use this checklist after deploying TalkForge with real providers.

For the full end-to-end staging flow (scenario → realtime → report → Shadowing), start with [`staging-readiness.md`](./staging-readiness.md).

## Health And Provider Status

1. `GET /api/health` returns `200` when PostgreSQL (and Redis when enabled) are healthy.
2. `GET /api/health?detail=1` additionally returns:
   - configured provider configuration checks
   - AI invocation aggregate metrics (when the database is reachable)
   - per-provider operation breakdown
3. In production, `detail=1` requires `OPS_HEALTH_DETAIL_TOKEN` via `Authorization: Bearer <token>` or `X-Ops-Health-Token`.

Expected provider failures (missing API keys, bucket config) surface as `providers.ok = false` with actionable `message` fields and `checkKind: "configuration"`. No secrets appear in the response.

## Provider Call Logging

1. Start a session and complete at least one user turn with audio upload.
2. Inspect server logs for `[talkforge:provider] call` entries containing:
   - `provider`, `operation`, `latencyMs`, `status`, `retryCount`
   - optional `costEstimate` when tracing captured usage
   - `category` for alert routing
3. Confirm logs never include API keys, authorization headers, or raw audio bytes.

## AI Invocation Aggregation

When `AI_TRACING_ENABLED=true`, verify `ai_invocation_logs` rows exist for realtime, ASR, and downstream jobs.

With `detail=1` health output:

- `aiInvocations.totalCalls` increases after practice activity
- `aiInvocations.errorRate` stays near `0` during healthy runs
- `providerBreakdown` lists operations such as `asr.transcribe` and `realtime.session.create`

## Session Usage Limits

Configure tight limits for a staging smoke test:

```env
SESSION_MAX_TURNS=2
SESSION_MAX_ASR_JOBS=1
SESSION_MAX_REPORT_ATTEMPTS=1
```

Verify:

1. Creating an extra user turn returns `409` with `session_turn_limit`.
2. Uploading audio beyond the ASR cap returns `409` with `session_asr_limit`.
3. Progress API includes `usageLimits` with `turnLimitReached` / `asrLimitReached` flags.
4. ASR usage counts the higher of turn-linked audio segments and `asr.transcribe` invocation logs.
5. The conversation UI shows the corresponding user-facing banner and disables practice actions when blocked.

Reset limits to production values before inviting real users.

## Provider Failure Fallbacks

1. Misconfigure a realtime credential and start a session.
2. Confirm API returns `realtime_unavailable` with a user-safe message.
3. In the UI, retry and text-practice fallback controls remain available when the session is otherwise active.

## Alert-Ready Categories

Operational log lines use `category` values such as:

- `provider_timeout`
- `provider_rate_limit`
- `provider_unavailable`
- `session_usage_limit`

Wire these categories to your monitoring alerts in staging/production.
