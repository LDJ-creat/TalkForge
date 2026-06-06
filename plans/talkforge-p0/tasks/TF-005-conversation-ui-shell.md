# TF-005 Conversation UI Shell

## Branch

`feature/tf-005-conversation-ui-shell`

## Context

The P0 user experience starts with choosing a scenario and entering a realtime voice conversation. This task builds the UI shell and state model using mocks.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-003-scenario-engine.md`
- `plans/talkforge-p0/tasks/TF-004-provider-contracts.md`

## Goal

Build the scenario selection and conversation UI shell with typed session state.

## Scope

Implement:

- Scenario picker using seed scenarios.
- Conversation page shell.
- Zustand or equivalent state store for:
  - selected scenario
  - session status
  - connection status
  - current turn status
  - transcript placeholders
  - ending state
- Mock realtime session start/stop behavior.
- Visible but unobtrusive end-practice control.

Do not implement:

- Real microphone capture.
- Real realtime model connection.
- ASR or report generation.

## Implementation Notes

- Keep the UI functional, not a marketing landing page.
- The first screen should let users start practicing.
- Avoid showing correction feedback during active conversation except placeholder status.
- Use responsive layout from the start.

## Tests

- Component tests for scenario selection and session start/end.
- Store unit tests for major state transitions.
- Manual browser test for the scenario picker and conversation shell.

## Acceptance Criteria

- User can select a scenario and enter a mock conversation screen.
- User can manually end the session.
- UI state is typed and ready for real provider wiring.
- No real provider calls are made.

## PR Notes

PR title example:

`feat: add scenario picker and conversation UI shell`

