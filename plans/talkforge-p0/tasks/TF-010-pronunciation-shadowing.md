# TF-010 Pronunciation And Shadowing

## Branch

`feature/tf-010-pronunciation-shadowing`

## Context

TalkForge separates free conversation lightweight evaluation from strict Shadowing evaluation. Free conversation has no fixed standard text, while Shadowing uses standard sentences and standard audio.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-004-provider-contracts.md`
- `plans/talkforge-p0/tasks/TF-006-storage-audio-upload.md`
- `plans/talkforge-p0/tasks/TF-007-queue-worker-foundation.md`

## Goal

Implement the pronunciation evaluation contracts and Shadowing standard-audio foundation.

## Scope

Implement:

- `evaluation.freeSpeech` worker handler using mock lightweight evaluation.
- Domain model/helpers for Shadowing items.
- TTS provider boundary for standard audio.
- Pronunciation evaluation provider boundary for Shadowing.
- APIs or helpers to create recommended Shadowing sentences from scenario target expressions or report inputs.

Do not implement:

- Real phoneme-level vendor integration unless explicitly configured.
- Full Shadowing UI if the UI foundation is not ready.
- Free-conversation phoneme-level scoring.

## Implementation Notes

- Free-speech evaluation may include fluency, pace, pause ratio, clarity, and completeness-like metrics.
- Shadowing requires standard text.
- Standard audio should be cached and linked to provider/voice/speed metadata.
- Keep evaluation result shape compatible with later vendor details.

## Tests

- Worker tests for mock free-speech evaluation.
- Tests for standard audio cache key generation.
- Tests that Shadowing evaluation requires standard text.

## Acceptance Criteria

- Free-speech evaluation can run asynchronously for a user turn.
- Shadowing items can be created from standard text.
- Standard audio generation is abstracted through a provider interface.
- Free conversation and Shadowing evaluation modes are clearly separated.

## PR Notes

PR title example:

`feat: add pronunciation evaluation and shadowing contracts`

