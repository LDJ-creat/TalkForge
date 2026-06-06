# TF-002 Domain Schema

## Branch

`feature/tf-002-domain-schema`

## Context

TalkForge depends on stable domain contracts for scenarios, sessions, turns, transcripts, audio segments, corrections, evaluations, and reports. This PR establishes persistence and shared types.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-001-project-foundation.md`

## Goal

Define the P0 domain model and database schema.

## Scope

Implement:

- Shared TypeScript domain types for:
  - `Scenario`
  - `ScenarioProgress`
  - `Session`
  - `Turn`
  - `AudioSegment`
  - `Transcript`
  - `Correction`
  - `PronunciationEvaluation`
  - `Report`
- ORM schema for the same core entities.
- Basic repository or data-access helpers if the project structure already supports them.
- Seed-ready structure for scenarios, but not full scenario engine logic.

Do not implement:

- Scenario prompt generation.
- UI.
- Worker execution.
- External API calls.

## Implementation Notes

- Use PostgreSQL-oriented schema even if local development uses SQLite temporarily.
- Audio binary content must not be stored in the database.
- Store audio object keys and metadata only.
- Use explicit enums for status fields.
- Keep provider-specific raw payloads in JSON fields only when necessary.

## Tests

- Type tests or unit tests for schema/type compatibility where practical.
- ORM validation/generation command.
- `npm run test`
- `npm run build`

## Acceptance Criteria

- Domain contracts compile.
- Database schema includes all P0 entities.
- Future tasks can import shared types without circular dependencies.
- Schema reflects the design document's turn-centered architecture.

## PR Notes

PR title example:

`feat: add TalkForge domain schema and shared contracts`

