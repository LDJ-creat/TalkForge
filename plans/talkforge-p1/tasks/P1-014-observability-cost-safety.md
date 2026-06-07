# P1-014 Observability Cost And Safety

## Branch

`feature/p1-014-observability-cost-safety`

## Context

Real providers introduce latency, cost, quota, and failure risks. Before real-user usage, TalkForge needs provider observability, cost controls, health checks, and safety fallbacks.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md`
- P1 provider task files P1-006 through P1-013

## Goal

Add operational readiness for real provider usage.

## Scope

Implement:

- Provider call logging/metrics:
  - provider
  - operation
  - latency
  - success/failure
  - retry count
  - approximate cost units where available
- Health-check endpoint or internal status screen.
- Aggregation over `AiInvocationLog` records for model call counts, latency, error rate, and cost estimates.
- Per-session limits:
  - max realtime duration
  - max turns
  - max ASR jobs
  - max report generation attempts
- User-facing fallback states for provider failures.
- Alert-ready structured error categories.
- Documentation for operational verification.

Do not implement:

- Full billing system.
- External monitoring SaaS integration unless already present.
- Admin dashboard beyond minimal health visibility.
- Raw request/response trace persistence; that belongs to P1-005.

## Implementation Notes

- Do not log raw sensitive audio or secrets.
- Cost tracking can start as estimated usage metadata.
- Use the P1-005 AI invocation trace layer as the source for model call count and cost summaries where possible.
- Include provider timeout and failure classification in logs.
- Make limits configurable.

## Tests

- Unit tests for limit enforcement.
- Tests for provider call metadata capture.
- Health-check tests.
- Failure-state tests where UI/API behavior is touched.

## Acceptance Criteria

- Provider calls are observable.
- Expensive or runaway sessions are bounded.
- Provider failures produce actionable errors.
- No sensitive secrets or raw audio are logged.

## PR Notes

PR title example:

`feat: add provider observability and usage safety`
