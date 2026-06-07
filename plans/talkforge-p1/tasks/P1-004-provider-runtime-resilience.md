# P1-004 Provider Runtime Resilience

## Branch

`feature/p1-004-provider-runtime-resilience`

## Context

P1 introduces real external calls. Every provider integration needs consistent timeout, retry, rate-limit, health-check, circuit-breaker/fallback, and error normalization behavior.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-001-runtime-config-secrets.md`

## Goal

Add shared runtime utilities for resilient provider calls.

## Scope

Implement:

- Timeout wrapper for provider calls.
- Retry policy with bounded attempts and backoff.
- Normalized provider error type.
- Provider health check interface.
- Rate-limit or concurrency guard utility.
- Structured provider call metadata:
  - provider name
  - operation
  - latency
  - status
  - retry count
  - normalized error code

Do not implement:

- Real provider business logic.
- Full observability dashboard.
- Cost accounting beyond metadata hooks.

## Implementation Notes

- Keep utilities provider-agnostic.
- Do not retry non-retryable errors such as invalid credentials.
- Make timeout values configurable.
- Worker tasks should be able to mark provider failures as retryable or terminal.

## Tests

- Timeout behavior tests.
- Retry behavior tests.
- Error normalization tests.
- Health-check contract tests.

## Acceptance Criteria

- Later provider integrations can share one resilience layer.
- Provider errors become predictable app errors.
- Retry behavior is bounded.
- No provider call can hang indefinitely.

## PR Notes

PR title example:

`feat: add resilient provider call runtime`

