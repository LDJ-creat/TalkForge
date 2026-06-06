# TF-003 Scenario Engine

## Branch

`feature/tf-003-scenario-engine`

## Context

TalkForge scenarios are structured tasks, not plain prompts. A scenario defines role, situation, mission, goals, stages, exit policy, and evaluation rubric.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-002-domain-schema.md`

## Goal

Implement structured scenario configuration, seed scenarios, and prompt generation for realtime AI sessions.

## Scope

Implement:

- Scenario config loader or repository.
- P0 seed scenarios, including at least:
  - coffee ordering
  - English interview
  - self introduction
  - meeting update
  - travel directions
- Function to convert structured `Scenario` into realtime system instructions.
- Validation for required fields and exit policy.
- Unit tests for prompt generation and scenario validation.

Do not implement:

- Realtime provider connection.
- UI scenario picker beyond what is required for tests.
- LLM Judge.

## Implementation Notes

- Keep scenario definitions data-driven.
- Prompts should be concise and stable.
- Do not pass raw full JSON to the model as the primary prompt.
- Include behavior rules: stay in role, do not interrupt with corrections, offer hints when user struggles, suggest ending after goals are complete.

## Tests

- Validate all seed scenarios.
- Snapshot or structured tests for generated system instructions.
- Test invalid exit policy handling.

## Acceptance Criteria

- At least five P0 scenarios exist.
- Each scenario has goals, stages, target expressions, constraints, and exit policy.
- Prompt generation is deterministic.
- Tests cover happy path and validation failure.

## PR Notes

PR title example:

`feat: add structured scenario engine and seed scenarios`

