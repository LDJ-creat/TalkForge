# P1-002 Real Infrastructure

## Branch

`feature/p1-002-real-infrastructure`

## Context

P1 needs real PostgreSQL, Redis, migrations, and worker runtime behavior. Mock or in-memory infrastructure is not enough to verify provider-backed async chains.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-001-runtime-config-secrets.md`

## Goal

Configure real database, queue, and worker infrastructure for local/staging use.

## Scope

Implement:

- PostgreSQL connection configuration.
- Redis/BullMQ real connection configuration.
- Migration/bootstrap instructions.
- Local development infrastructure setup, for example Docker Compose if consistent with the repo.
- Worker start scripts for real queue processing.
- Health checks for database and Redis.

Do not implement:

- Real AI provider calls.
- Object storage provider integration.
- New domain schema unless required by existing P0 gaps.

## Implementation Notes

- Preserve test isolation. Tests should not require a developer's personal production database.
- If Docker Compose is added, keep services minimal: Postgres and Redis.
- Avoid coupling worker startup to the Next.js dev server unless the project already chose that pattern.
- Document how to run migrations and workers.

## Tests

- Config/connection tests where practical.
- Migration validation.
- Worker boot smoke test.
- `npm run build`
- `npm run test`

## Acceptance Criteria

- App can connect to real PostgreSQL and Redis in local/staging mode.
- Workers can process jobs from real Redis.
- Existing P0 mock tests still pass.
- Documentation explains setup and teardown.

## PR Notes

PR title example:

`feat: configure real PostgreSQL Redis and worker runtime`

