# P1-007 Realtime UI Lifecycle

## Branch

`feature/p1-007-realtime-ui-lifecycle`

## Context

After real realtime provider integration, the conversation UI must handle real connection lifecycle, interruptions, latency, errors, and fallback states.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-006-realtime-provider-integration.md`

## Goal

Wire the conversation UI to real realtime session lifecycle.

## Scope

Implement:

- Real session start flow using backend-issued realtime session/token.
- Connection states:
  - idle
  - connecting
  - connected
  - listening
  - assistantSpeaking
  - interrupted
  - reconnecting
  - failed
  - fallback
  - ended
- User-visible error and retry behavior.
- Manual end behavior with cleanup.
- Basic latency/connection status display for debug or development mode.

Do not implement:

- ASR or report UI.
- New visual redesign unrelated to lifecycle.
- Provider-specific code inside generic UI components.

## Implementation Notes

- Keep provider-specific protocol details in hooks/adapters, not components.
- User should always be able to end the session.
- If realtime fails, UI should offer retry or fallback rather than becoming stuck.
- Preserve audio recording behavior from P0.

## Tests

- State transition tests.
- Component tests for error/retry/end states.
- Manual browser test with real realtime provider.

## Acceptance Criteria

- User can start and end a real realtime voice session.
- UI handles connection failure and retry.
- UI does not expose provider secrets.
- Mock mode remains usable.

## PR Notes

PR title example:

`feat: wire conversation UI to realtime lifecycle`
