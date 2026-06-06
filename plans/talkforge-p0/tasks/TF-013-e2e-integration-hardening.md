# TF-013 E2E Integration Hardening

## Branch

`feature/tf-013-e2e-integration-hardening`

## Context

After the core pieces are implemented, TalkForge needs a coherent P0 demo path using mocks: select scenario, start session, record/upload a turn, run background jobs, end session, generate report.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- All TF-001 through TF-012 task files as needed.

## Goal

Wire the P0 flow end-to-end and harden rough edges.

## Scope

Implement:

- End-to-end mock demo path.
- Development seed data and mock provider configuration.
- UI/API wiring for:
  - start scenario session
  - capture/upload user turn
  - enqueue/process mock jobs
  - view report
  - end session
- Basic observability logs for session/job lifecycle.
- Final documentation updates for local run and verification.

Do not implement:

- Real paid external provider integrations.
- Major redesigns of earlier tasks.
- P1/P2 features.

## Implementation Notes

- Keep hardening fixes small and directly tied to the P0 demo.
- If a bug belongs to a previous task's scope, fix it only if required for end-to-end flow and document it.
- Prefer mocks and local providers for deterministic verification.

## Tests

- E2E or integration test for the P0 happy path.
- Manual verification script or checklist.
- `npm run build`
- `npm run test`
- `npm run lint`

## Acceptance Criteria

- A developer can run the app locally and complete the P0 mock flow.
- Session, turn, transcript, correction, evaluation, progress, and report data are connected.
- No real provider credentials are required.
- Documentation explains how to verify the flow.

## PR Notes

PR title example:

`feat: wire TalkForge P0 mock flow end to end`

