# TF-008 ASR Pipeline

## Branch

`feature/tf-008-asr-pipeline`

## Context

P0 uses external ASR APIs through a provider abstraction. The ASR pipeline consumes uploaded user-turn audio and produces normalized transcripts with confidence and timestamps where available.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-004-provider-contracts.md`
- `plans/talkforge-p0/tasks/TF-006-storage-audio-upload.md`
- `plans/talkforge-p0/tasks/TF-007-queue-worker-foundation.md`

## Goal

Implement the ASR job pipeline with a mock provider and normalized transcript persistence.

## Scope

Implement:

- `asr.transcribe` worker handler.
- ASR provider selection/configuration boundary.
- Mock ASR provider for local development.
- Transcript persistence linked to `Turn`.
- Job chaining hook to enqueue correction/evaluation after successful ASR.

Do not implement:

- faster-whisper.
- Real vendor SDK integration unless credentials and requirements are explicitly provided.
- Grammar correction logic.

## Implementation Notes

- Use `audioObjectKey`, not raw audio blob, in job payloads.
- Save ASR confidence when available.
- Preserve word timestamps when available.
- Low-confidence transcript behavior is handled by later correction tasks but should be represented in the data model.

## Tests

- Worker test with mock provider.
- Transcript persistence test.
- Failure test for missing audio segment.
- Test that successful ASR can enqueue downstream jobs.

## Acceptance Criteria

- Uploaded user-turn audio can produce a transcript through a mock ASR provider.
- Transcript is normalized and persisted.
- Worker is idempotent enough to avoid duplicate transcript rows on retry.
- No real ASR vendor is hard-coded into domain code.

## PR Notes

PR title example:

`feat: add ASR transcription pipeline`

