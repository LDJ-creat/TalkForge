# P1-013 Pronunciation Evaluation Provider

## Branch

`feature/p1-013-pronunciation-evaluation-provider`

## Context

Strict pronunciation scoring belongs to Shadowing mode, where standard text is known. P1 integrates a real pronunciation evaluation provider for Shadowing recordings only.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-003-object-storage-provider.md`
- `plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md`
- `plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md`
- `plans/talkforge-p1/tasks/P1-012-shadowing-content-pipeline.md`

## Goal

Integrate real Shadowing pronunciation evaluation.

## Scope

Implement:

- Real pronunciation evaluation provider adapter.
- Required audio format conversion or validation.
- Shadowing evaluation worker/API.
- Mapping provider results to normalized `PronunciationEvaluation`.
- Word/phoneme-level details where provider supports them.
- User-facing evaluation status and error handling if UI exists.

### Follow-up (out of scope for P1-013)

- **Client integration**: wiring conversation UI to upload shadowing attempts and call `POST /api/sessions/:sessionId/shadowing/evaluate`.
- **In-app evaluation UX**: recording controls, processing/scored/failed states, and score presentation in `ShadowingPracticePanel` (backend API + worker are ready; UI copy may note the deferral).

Follow-up implemented after P1-013:

- Free-conversation pronunciation now reuses iFlytek ISE `read_sentence` with the ASR transcript as `referenceText`.
- Transcript panel shows per-turn scores and weak words; raw provider XML stays server-side.

Do not implement:

- New provider-specific UI that leaks raw response structure.

## Implementation Notes

- Verify current official pronunciation evaluation provider docs during implementation.
- Many providers require PCM/WAV sample rate and mono audio. Add conversion through existing media pipeline or worker utility.
- Standard text must be sent with the recording.
- Keep raw provider details optional and bounded.

## Tests

- Adapter tests using real-shaped provider response fixtures.
- Audio format validation/conversion tests.
- Worker/API tests for Shadowing evaluation.
- Manual staging test with one short Shadowing recording.

## Acceptance Criteria

- A Shadowing recording can be evaluated by a real provider.
- Scores are normalized and persisted.
- Unsupported audio format errors are clear.
- Free conversation remains lightweight and is not mis-scored as Shadowing.

## PR Notes

PR title example:

`feat: integrate real shadowing pronunciation evaluation`
