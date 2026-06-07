# P1-012 Shadowing Content Pipeline

## Branch

`feature/p1-012-shadowing-content-pipeline`

## Context

P0 defines Shadowing contracts. P1 should generate real Shadowing practice items from scenario target expressions and session reports, then attach real standard audio.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-009-text-llm-correction-report-provider.md`
- `plans/talkforge-p1/tasks/P1-011-tts-standard-audio-provider.md`

## Goal

Build the real Shadowing content generation pipeline.

## Scope

Implement:

- Shadowing item creation from:
  - scenario target expressions
  - report recommended sentences
  - corrected user expressions
- Standard audio generation/caching handoff.
- API to fetch Shadowing items for a session.
- Basic UI wiring if P0 already has the Shadowing UI shell.

Do not implement:

- Real pronunciation evaluation provider.
- Large curriculum recommendation engine.

## Implementation Notes

- Keep item count limited for P1, for example 3-5 recommended items per session.
- Prefer sentences that directly address user mistakes.
- Store standard text separately from user original text.
- Do not require pronunciation evaluation to exist before showing standard audio practice.

## Tests

- Unit tests for Shadowing item selection.
- Integration tests for report-to-shadowing generation.
- API tests for fetching session Shadowing items.
- Manual test with a completed report.

## Acceptance Criteria

- Completed sessions can produce Shadowing practice items.
- Each item has standard text and standard audio metadata or generation status.
- Items are tied to the session and source correction/report.
- The pipeline works before pronunciation scoring is integrated.

## PR Notes

PR title example:

`feat: generate shadowing practice content from reports`
