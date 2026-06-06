# TF-011 Report Generation

## Branch

`feature/tf-011-report-generation`

## Context

After a session ends, TalkForge generates a report from scenario goals, transcripts, corrections, and evaluation results. The report should focus on actionable next steps, not just scores.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-008-asr-pipeline.md`
- `plans/talkforge-p0/tasks/TF-009-correction-pipeline.md`
- `plans/talkforge-p0/tasks/TF-010-pronunciation-shadowing.md`

## Goal

Implement session report generation.

## Scope

Implement:

- `report.generate` worker handler.
- Report aggregation from:
  - scenario goals
  - transcripts
  - corrections
  - free-speech evaluation
  - Shadowing recommendations
- Mock LLM report provider or deterministic report builder.
- Report persistence.
- API to fetch a report by session id.

Do not implement:

- Full polished report UI unless already available.
- Long-term learning analytics.

## Implementation Notes

- Report should include:
  - summary
  - task completion
  - key corrections
  - stronger alternative expressions
  - recommended Shadowing sentences
  - next practice suggestion
- Prefer deterministic aggregation for scores and use LLM only for narrative summaries.

## Tests

- Report builder unit tests.
- Worker test using seeded transcript/correction/evaluation data.
- API test for fetching report.

## Acceptance Criteria

- Completed sessions can generate a report.
- Report is linked to the correct session.
- Report includes actionable corrections and Shadowing recommendations.
- Missing optional data does not crash report generation.

## PR Notes

PR title example:

`feat: generate session practice reports`

