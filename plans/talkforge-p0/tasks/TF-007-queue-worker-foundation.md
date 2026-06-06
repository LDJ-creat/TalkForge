# TF-007 Queue Worker Foundation

## Branch

`feature/tf-007-queue-worker-foundation`

## Context

Background teaching tasks must be asynchronous. ASR, correction, evaluation, scenario progress, and report generation should run through typed jobs with retry and status tracking.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-002-domain-schema.md`

## Goal

Add queue and worker infrastructure for P0 background jobs.

## Scope

Implement:

- Queue configuration.
- Typed job payload definitions.
- Job names for:
  - `asr.transcribe`
  - `correction.analyze`
  - `evaluation.freeSpeech`
  - `scenarioProgress.evaluate`
  - `report.generate`
- Worker registration pattern.
- Job status persistence or query helper.
- Mock worker execution for tests.

Do not implement:

- Actual ASR/correction/evaluation logic.
- UI progress display unless trivial.

## Implementation Notes

- BullMQ + Redis is the preferred P0 choice.
- If Redis is not available locally, provide a mock/in-memory adapter for tests.
- Job payloads should use domain IDs, not large binary payloads.

## Tests

- Unit tests for job payload validation.
- Integration-style tests for enqueueing and mock processing.
- Test retry/failure status where feasible.

## Acceptance Criteria

- Later tasks can enqueue typed jobs.
- Workers can be registered independently.
- Failed jobs have normalized error metadata.
- Tests do not require real external services.

## PR Notes

PR title example:

`feat: add typed background job foundation`

