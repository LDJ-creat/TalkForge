# TalkForge P1 Development Plan

## Goal

Turn the P0 mock framework into a real usable TalkForge application by integrating real providers and running the full learning loop end to end:

```text
Scenario selection
  -> realtime AI voice conversation
  -> user-turn audio capture and object storage
  -> ASR transcript
  -> grammar/expression correction
  -> scenario progress
  -> session report
  -> standard TTS audio
  -> Shadowing pronunciation evaluation
```

## Source Of Truth

- Product/system design: `TalkForge-Design.md`
- Project instructions: `AGENTS.md`
- P0 framework plan: `plans/talkforge-p0/plan.md`
- P1 task index: `plans/talkforge-p1/tasks.md`
- P1 execution guide: `plans/talkforge-p1/development-order-guide.md`

## P1 Scope

P1 includes:

- Environment and secret configuration for real providers.
- Real PostgreSQL/Redis/object storage setup for non-mock local/staging use.
- Real private object storage integration.
- Real realtime audio model integration through the existing realtime provider contract.
- Realtime session token/session creation that does not expose long-lived secrets.
- Real ASR provider integration.
- Real text LLM integration for corrections, scenario progress judgment, and reports.
- Real TTS provider integration for standard audio.
- Real pronunciation evaluation provider integration for Shadowing.
- AI invocation tracing for model call counts, prompt/version tracking, raw provider outputs, latency, tokens/audio duration, and cost estimates.
- Worker orchestration using real queues and real provider calls.
- User-facing progress, error, retry, and fallback states.
- Provider health checks, latency/cost logging, and operational readiness.
- E2E validation with real providers in a staging-like environment.

P1 excludes:

- Self-hosted faster-whisper.
- Teacher/admin dashboards.
- Organization/multi-tenant management.
- Complex user-generated scenarios beyond provider-backed validation if already supported.
- Full free-conversation phoneme-level pronunciation scoring.

## Provider Selection Assumption

P1 should keep providers configurable. The first real provider for each category can be chosen by configuration:

- Realtime voice model: Qwen Omni Realtime or Doubao Realtime.
- ASR: external ASR service selected by env/config.
- Text LLM: provider selected by env/config.
- TTS: provider selected by env/config.
- Pronunciation evaluation: professional speech evaluation API, such as iFlytek-style evaluation.
- Object storage: S3-compatible storage, Cloudflare R2, Aliyun OSS, or MinIO.

Implementation tasks must verify current official provider docs during implementation, because realtime and speech APIs change frequently.

## Milestones

### Milestone 1: Real Runtime Foundations

Complete P1-001 through P1-004. The app has real env validation, real infrastructure configuration, real object storage, and a production-safe provider runtime shell.

### Milestone 2: Real Conversation

Complete P1-005 through P1-007. AI invocation tracing exists before real provider integrations, users can start a real realtime audio session through secure backend-issued credentials, and the UI can handle real connection lifecycle and fallback states.

### Milestone 3: Real Teaching Pipeline

Complete P1-008 through P1-012. Uploaded audio can be transcribed, corrected, judged for scenario progress, summarized, and converted into standard-audio Shadowing assets.

### Milestone 4: Real Pronunciation And Closure

Complete P1-013 through P1-015. Shadowing pronunciation evaluation works with real provider calls, observability/cost controls are available, and the complete real-provider E2E flow is verified.

## Task List

Tasks are stored in `plans/talkforge-p1/tasks/`.

Recommended sequence:

1. `P1-001-runtime-config-secrets.md`
2. `P1-002-real-infrastructure.md`
3. `P1-003-object-storage-provider.md`
4. `P1-004-provider-runtime-resilience.md`
5. `P1-005-ai-invocation-tracing.md`
6. `P1-006-realtime-provider-integration.md`
7. `P1-007-realtime-ui-lifecycle.md`
8. Parallel group A:
   - `P1-008-asr-provider-integration.md`
   - `P1-009-text-llm-correction-report-provider.md`
   - `P1-010-scenario-progress-judge-provider.md`
9. Parallel group B:
   - `P1-011-tts-standard-audio-provider.md`
   - `P1-012-shadowing-content-pipeline.md`
10. `P1-013-pronunciation-evaluation-provider.md`
11. `P1-014-observability-cost-safety.md`
12. `P1-015-real-e2e-staging-readiness.md`

## Branch Strategy

Default: one task, one branch, one PR.

Use `main` as the base branch unless the repository has a different current base branch.

For strong dependency chains, stacked PRs are allowed, but each task still needs its own branch and PR.

Branch examples:

- `feature/p1-001-runtime-config-secrets`
- `feature/p1-006-realtime-provider-integration`
- `feature/p1-015-real-e2e-staging-readiness`

## Exit Criteria

P1 is complete when:

- The app can run the full real-provider loop without mock data.
- All real provider credentials are supplied through env/config and never exposed to the browser.
- The realtime voice conversation works with at least one configured provider.
- User audio is stored privately and can be consumed by downstream workers.
- ASR, correction, scenario progress, report, TTS, and Shadowing evaluation can run through real providers.
- AI invocation logs can show model call counts, raw request/response traces when enabled, prompt versions, latency, token/audio usage, and cost estimates.
- Provider failures produce visible user-facing fallback states and structured logs.
- A documented staging verification checklist passes.
