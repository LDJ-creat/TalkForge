# P1-010 Scenario Progress Judge Provider

## Branch

`feature/p1-010-scenario-progress-judge-provider`

## Context

P0 scenario progress may be mock or rule-only. P1 should use a real/configurable LLM judge to evaluate scenario goal completion and off-topic behavior while keeping deterministic rule fallback.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md`
- `plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md`
- `plans/talkforge-p1/tasks/P1-009-text-llm-correction-report-provider.md`

## Goal

Integrate real scenario progress judgment.

## Scope

Implement:

- Scenario progress judge provider.
- Prompt builder using:
  - structured scenario goals
  - current stage
  - recent transcript
  - existing completed goals
- Structured output parsing for:
  - completed goals
  - missing goals
  - current stage
  - off-topic flag
  - shouldSuggestEnding
- Deterministic rule fallback for max turns, max duration, and manual end.

Do not implement:

- Forced AI-only ending.
- New scenario authoring UI.

## Implementation Notes

- Judge output is advisory except for deterministic rules.
- Required goals complete should suggest ending, not automatically end without user confirmation.
- Keep prompt short to control cost.
- Run judge every configured number of user turns or at session end.

## Tests

- Prompt builder tests.
- Output parsing tests.
- Rule fallback tests.
- Worker tests with mock real-shaped judge response.

## Acceptance Criteria

- Scenario progress updates from real/configurable judge output.
- Deterministic exit policy still works if judge fails.
- `shouldSuggestEnding` is set when goals are complete.
- Off-topic behavior is represented without breaking conversation.

## PR Notes

PR title example:

`feat: add real scenario progress judge`
