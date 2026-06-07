# P1-003 Object Storage Provider

## Branch

`feature/p1-003-object-storage-provider`

## Context

Real ASR, pronunciation evaluation, and replay require real private audio object storage. P0 storage mocks must be replaced or supplemented by a real provider behind the existing storage contract.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-001-runtime-config-secrets.md`
- `plans/talkforge-p1/tasks/P1-002-real-infrastructure.md`

## Goal

Integrate real private object storage for audio and generated standard audio.

## Scope

Implement:

- Real storage provider behind the existing object storage interface.
- Signed upload/download URL generation or server-mediated upload if chosen.
- Object key conventions for:
  - user turn audio
  - converted audio artifacts
  - TTS standard audio
- Private object defaults.
- Delete operation for privacy and cleanup.
- Metadata persistence compatibility with `AudioSegment` and standard-audio assets.

Do not implement:

- ASR provider calls.
- TTS generation.
- Pronunciation evaluation provider calls.

## Implementation Notes

- Prefer S3-compatible contract if it matches the chosen provider.
- Do not expose bucket credentials to the browser.
- Signed URLs should be short-lived.
- Object keys should include stable IDs and avoid user-provided filenames.
- Include content type and size checks where possible.

## Tests

- Unit tests for object key generation.
- Provider tests using mock or local storage adapter.
- API tests for signed upload/download behavior.
- Manual staging checklist for real object storage.

## Acceptance Criteria

- User audio can be uploaded to private real object storage.
- Backend can create temporary read access for workers or playback.
- Object deletion is supported.
- Mock storage remains available for tests.

## PR Notes

PR title example:

`feat: integrate private object storage provider`

