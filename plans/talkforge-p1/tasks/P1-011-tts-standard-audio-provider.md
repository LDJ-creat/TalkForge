# P1-011 TTS Standard Audio Provider

## Branch

`feature/p1-011-tts-standard-audio-provider`

## Context

Shadowing requires standard native-like audio for target expressions and report-generated recommended sentences. P1 needs real TTS generation with caching in private object storage.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-003-object-storage-provider.md`
- `plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md`
- `plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md`

## Goal

Integrate real TTS standard-audio generation.

## Scope

Implement:

- Real TTS provider adapter.
- Standard audio generation worker or service.
- Cache key generation by:
  - text
  - voice
  - speed
  - provider
  - language/accent
- Private object storage persistence for generated audio.
- Standard audio metadata persistence.

Do not implement:

- Pronunciation evaluation provider.
- Full Shadowing UI if not already present.

## Implementation Notes

- Verify current official TTS provider docs during implementation.
- Avoid regenerating identical standard audio.
- Store generated audio privately and serve via signed access.
- Select one default English voice suitable for learners.

## Tests

- Cache key tests.
- Provider adapter tests with mocked TTS response.
- Worker/service tests for cache hit and miss.
- Manual staging test generating one standard sentence.

## Acceptance Criteria

- Standard audio can be generated for a given English sentence.
- Repeated requests reuse cached audio.
- Audio metadata includes provider, voice, speed, and object key.
- Mock TTS remains available for tests.

## PR Notes

PR title example:

`feat: integrate real TTS for standard audio`
