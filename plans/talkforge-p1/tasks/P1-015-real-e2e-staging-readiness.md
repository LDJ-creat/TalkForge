# P1-015 Real E2E Staging Readiness

## Branch

`feature/p1-015-real-e2e-staging-readiness`

## Context

P1 is complete only when the real-provider loop works end to end in a staging-like environment. This task should harden integration and document verification, not introduce new feature scope.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/plan.md`
- All P1 task files as needed.

## Goal

Verify and document the complete real-provider TalkForge flow.

## Scope

Implement:

- Staging readiness checklist.
- E2E or guided integration test for:
  - scenario selection
  - realtime voice session
  - user-turn audio upload
  - ASR transcript
  - correction generation
  - scenario progress update
  - session ending
  - report generation
  - standard audio generation
  - Shadowing pronunciation evaluation
- verification that AI invocation traces are written for ASR, LLM, TTS, and pronunciation evaluation calls
- Seed/demo scenario and short test script.
- Final docs for env setup and verification.
- Small integration fixes required for the flow.

Do not implement:

- New product features.
- Major UI redesign.
- Provider rewrites unless required to fix broken integration.

## Implementation Notes

- Use real providers in staging/manual verification.
- Automated tests may mock external calls if real provider calls are unsuitable for CI.
- Clearly separate CI-safe tests from manual real-provider checks.
- Record known limitations and follow-up tasks.

## Tests

- `npm run lint`
- `npm run test`
- `npm run build`
- CI-safe E2E/integration test with provider mocks.
- Manual real-provider staging checklist.

## Acceptance Criteria

- A developer/operator can run the documented staging flow.
- The full learning loop works with real providers.
- All required env variables are documented.
- AI invocation trace behavior is documented and verified in staging.
- Known limitations are documented.
- No new P2 scope is introduced.

## PR Notes

PR title example:

`feat: verify TalkForge real-provider P1 flow`
