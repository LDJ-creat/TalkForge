# P1-008 ASR Provider Integration

## Branch

`feature/p1-008-asr-provider-integration`

## Context

P0 ASR uses mocks. P1 must transcribe real uploaded user-turn audio through a real ASR provider and persist normalized transcripts.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-003-object-storage-provider.md`
- `plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md`
- `plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md`

## Goal

Integrate a real ASR provider behind the existing ASR contract.

## Scope

Implement:

- Real ASR provider adapter.
- Audio object retrieval or signed access for ASR input.
- Audio format compatibility handling required by the provider.
- Normalization to existing `Transcript` shape.
- Confidence and word/segment timestamp mapping where provider supports it.
- Worker integration with retry/error handling.
- Provider config documentation.

Do not implement:

- Self-hosted faster-whisper.
- Correction logic.
- UI report changes.

## Implementation Notes

- Verify current official ASR provider docs during implementation.
- If the ASR provider cannot consume `webm/opus`, add a conversion step or queue handoff to existing media utilities.
- Keep raw provider response optional and controlled.
- Make the worker idempotent to avoid duplicate transcripts on retry.

## Tests

- Provider adapter tests with recorded/mocked provider responses.
- Worker test using real-shaped mock response.
- Manual staging test with a short English audio sample.
- Failure tests for unsupported format and missing audio.

## Acceptance Criteria

- Real uploaded audio can produce a transcript.
- Transcript is normalized and linked to the correct turn.
- ASR errors are retried or surfaced consistently.
- Mock ASR remains available for tests.

## PR Notes

PR title example:

`feat: integrate real ASR provider`
