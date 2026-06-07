# P1-006 Realtime Provider Integration

## Branch

`feature/p1-006-realtime-provider-integration`

## Context

Realtime voice conversation is the primary TalkForge user experience. P1 must integrate at least one real realtime audio provider through the existing provider contract without exposing long-lived secrets to the browser.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-001-runtime-config-secrets.md`
- `plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md`
- `plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md`

## Goal

Integrate one real realtime audio provider for session creation and browser connection.

## Scope

Implement:

- Real realtime provider adapter.
- Backend endpoint to create short-lived realtime session/token.
- Prompt/session configuration using structured scenario system instructions.
- Provider session id persistence.
- Mock fallback mode.
- Documentation for required env variables and provider setup.

Do not implement:

- UI lifecycle changes beyond API contract needs.
- ASR or report pipeline changes.
- Multiple realtime providers unless the abstraction already makes it trivial.

## Implementation Notes

- Verify current official provider docs during implementation.
- Prefer WebRTC if the provider supports stable browser WebRTC; otherwise use provider-supported WebSocket realtime.
- Never expose long-lived API keys to the browser.
- Bind session/token to user/session/scenario where the provider supports it.
- Persist provider latency and session metadata if existing schema supports it.

## Tests

- Unit tests for provider request construction.
- API tests for token/session endpoint with mocked provider.
- Manual staging test with real provider credentials.
- Failure test for missing/invalid provider config.

## Acceptance Criteria

- Backend can create a real realtime session/token.
- Browser receives only short-lived connection material.
- Scenario instructions are included in the realtime session.
- Mock realtime provider still works for local tests.

## PR Notes

PR title example:

`feat: integrate real realtime voice provider`
