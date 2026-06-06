# TF-009 Correction Pipeline

## Branch

`feature/tf-009-correction-pipeline`

## Context

TalkForge corrects grammar and expression issues asynchronously from ASR transcripts. The system must distinguish likely language errors from ASR uncertainty.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-007-queue-worker-foundation.md`
- `plans/talkforge-p0/tasks/TF-008-asr-pipeline.md`

## Goal

Implement transcript-based grammar and expression correction.

## Scope

Implement:

- `correction.analyze` worker handler.
- LLM correction provider interface or use an existing provider contract from TF-004.
- Mock correction provider.
- Prompt builder using:
  - current transcript
  - recent session context
  - ASR confidence
  - scenario level
- Correction persistence.
- ASR uncertainty handling.

Do not implement:

- Report generation.
- UI correction display beyond APIs needed by tests.
- Direct audio-based correction as the primary path.

## Implementation Notes

- Correction types should include `grammar`, `expression`, `vocabulary`, `clarity`, and `asr_uncertain`.
- Prompt should instruct the model not to treat obvious ASR mistakes as grammar errors.
- Keep output structured and parseable.
- Store confidence for each correction.

## Tests

- Prompt builder unit tests.
- Worker test with mock provider.
- ASR low-confidence test producing `asr_uncertain` behavior.
- Persistence tests.

## Acceptance Criteria

- Corrections are generated from transcript text and context.
- Low-confidence ASR content is not over-corrected.
- Output is structured and linked to the correct turn.
- No realtime conversation is blocked by correction processing.

## PR Notes

PR title example:

`feat: add transcript-based correction pipeline`

