# TF-006 Storage And Audio Upload

## Branch

`feature/tf-006-storage-audio-upload`

## Context

TalkForge stores user audio in two stages: temporary IndexedDB cache in the browser and official private object storage on the backend. Database rows store metadata and object keys, not binary audio.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/tasks/TF-002-domain-schema.md`
- `plans/talkforge-p0/tasks/TF-004-provider-contracts.md`

## Goal

Implement the audio capture handoff, client cache contract, and backend upload flow.

## Scope

Implement:

- Client helper for storing turn audio blobs in IndexedDB.
- API route to create an audio upload target for a turn.
- API route or callback to finalize uploaded audio metadata.
- Storage provider mock/local implementation.
- `AudioSegment` creation/update flow.

Do not implement:

- Full microphone UI if TF-005 has not added it.
- ASR processing.
- Real cloud storage integration unless explicitly configured.

## Implementation Notes

- Browser recording format should be treated as `webm/opus`.
- Signed URLs or equivalent upload tokens should be short-lived.
- Uploaded objects must be private by default.
- Include deletion helper contract for later privacy work.

## Tests

- Unit tests for IndexedDB wrapper using a test adapter or mocked storage.
- API tests for upload target and finalize flow.
- Storage mock tests.

## Acceptance Criteria

- A user turn can receive an upload target.
- Audio metadata can be finalized and persisted.
- IndexedDB cache helper stores and retrieves audio blobs by turn id.
- No audio binary is stored in the database.

## PR Notes

PR title example:

`feat: add private audio upload and local cache flow`

