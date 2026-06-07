# P1-005 AI Invocation Tracing

## Branch

`feature/p1-005-ai-invocation-tracing`

## Context

P1 introduces many real AI calls: realtime session creation, ASR, LLM correction, LLM report generation, scenario progress judge, TTS, and pronunciation evaluation. Basic provider logs are not enough for debugging prompt quality, raw provider behavior, model comparison, or cost/effectiveness analysis.

This task adds a dedicated AI invocation tracing layer. It should capture structured metadata for every model/provider call and optionally persist raw request/response payloads in local files or private object storage.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/plan.md`
- `plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md`

## Goal

Add a reusable trace/audit layer for AI provider invocations.

## Scope

Implement:

- `AiInvocationLog` domain model or persistence representation.
- Trace writer interface for:
  - database summary records
  - local file raw traces in development
  - private object storage raw traces in staging/production when enabled
- Trace configuration:
  - enable/disable tracing
  - raw request capture
  - raw response capture
  - storage backend
  - sample rate
  - retention hint
  - PII redaction toggle
- Invocation metadata fields:
  - session id
  - turn id
  - job id
  - provider
  - model
  - operation
  - prompt version
  - latency
  - retry count
  - status
  - token counts where available
  - audio duration where available
  - cost estimate where available
  - normalized error fields
- Raw request/response object key or file path recording.
- Helper APIs/utilities so all provider adapters can wrap calls consistently.

Do not implement:

- Full analytics dashboard.
- Human evaluation workflow.
- Provider-specific business logic.
- Unbounded raw audio logging.

## Suggested Type

```ts
type AiInvocationLog = {
  id: string;
  sessionId?: string;
  turnId?: string;
  jobId?: string;
  provider: string;
  model: string;
  operation:
    | "realtime.session.create"
    | "asr.transcribe"
    | "llm.correction"
    | "llm.report"
    | "llm.scenarioJudge"
    | "tts.generate"
    | "pronunciation.evaluate";
  promptVersion?: string;
  inputObjectKey?: string;
  outputObjectKey?: string;
  requestSummary?: unknown;
  responseSummary?: unknown;
  rawRequestObjectKey?: string;
  rawResponseObjectKey?: string;
  status: "success" | "failed" | "timeout" | "rate_limited";
  latencyMs: number;
  retryCount: number;
  inputTokens?: number;
  outputTokens?: number;
  audioDurationMs?: number;
  costEstimate?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
};
```

## Implementation Notes

- Store queryable summaries in the database.
- Store raw request/response payloads outside the database.
- Do not log raw audio bytes. Store audio object keys only.
- Redact secrets and authorization headers.
- Raw transcript, prompt, and LLM output can contain private data, so raw capture must be configurable.
- In local development, file traces may be written under a clearly documented path such as `.storage/ai-traces/`.
- In staging/production, raw traces should go to private object storage with retention controls.
- Provider adapters should not each invent their own log shape.

## Tests

- Unit tests for trace config behavior.
- Unit tests for redaction.
- Tests for database summary persistence.
- Tests for local file trace writer if implemented.
- Tests that raw capture can be disabled.
- Tests that provider wrapper records success and failure traces.

## Acceptance Criteria

- Every P1 provider adapter can use one tracing interface.
- Model call counts can be queried by provider, model, operation, session, and date.
- Raw request/response traces can be captured when enabled.
- Raw capture can be disabled for privacy-sensitive environments.
- Trace records include enough metadata for debugging prompt quality and provider output parsing.
- No secrets or raw audio bytes are written to logs/traces.

## PR Notes

PR title example:

`feat: add AI invocation tracing for provider calls`
