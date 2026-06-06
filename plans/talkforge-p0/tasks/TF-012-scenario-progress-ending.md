# TF-012 Scenario Progress And Ending

## Branch

`feature/tf-012-scenario-progress-ending`

## Context

TalkForge scenarios should end through a combination of user control, protective limits, and goal completion. AI may suggest ending, but P0 should not depend on AI-only ending.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-003-scenario-engine.md`
- `plans/talkforge-p0/tasks/TF-005-conversation-ui-shell.md`
- `plans/talkforge-p0/tasks/TF-008-asr-pipeline.md`

## Goal

Implement scenario progress tracking and ending decisions.

## Scope

Implement:

- `ScenarioProgress` persistence/update logic.
- Rule-based progress checks:
  - max turns
  - max duration
  - manual end
  - required goals complete flag
- LLM Judge provider boundary or mock evaluator for goal completion.
- `scenarioProgress.evaluate` worker handler.
- UI/API state showing when AI should suggest ending.

Do not implement:

- Hard forced ending immediately after goals complete.
- Complex adaptive scenario generation.

## Implementation Notes

- P0 should suggest ending after required goals are complete, then let the user confirm.
- Judge output should be treated as advisory.
- Rules should be deterministic and testable.
- Off-topic detection can be mock/simple in P0.

## Tests

- Unit tests for exit policy rules.
- Worker tests for mock goal completion.
- Integration test for `shouldSuggestEnding`.
- UI/store test for manual end behavior if UI code is touched.

## Acceptance Criteria

- Scenario progress updates from transcript/turn data.
- Max turns and max duration are enforced as protective boundaries.
- Required goal completion can trigger an end suggestion.
- User manual ending remains available and highest priority.

## PR Notes

PR title example:

`feat: track scenario progress and ending decisions`

