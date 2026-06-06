# TF-004 Provider Contracts

## Branch

`feature/tf-004-provider-contracts`

## Context

TalkForge will use multiple external services, but P0 should avoid hard-binding domain code to one vendor. Provider interfaces make realtime, ASR, storage, TTS, and evaluation replaceable.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`

## Goal

Define provider abstraction interfaces and mock implementations.

## Scope

Implement provider contracts for:

- Realtime session/token creation.
- ASR transcription.
- Object storage signed upload/download/delete.
- TTS standard audio generation.
- Pronunciation evaluation.
- LLM text correction/report generation boundary if appropriate.

Include mock providers for local development and tests.

Do not implement:

- Real vendor integrations.
- UI.
- Queue execution.

## Implementation Notes

- Provider methods should return normalized domain objects, not raw vendor payloads.
- Preserve optional raw provider metadata in controlled fields if needed.
- Realtime provider should support short-lived session/token creation.
- Storage provider must assume private objects by default.

## Tests

- Unit tests for mock providers.
- Type-level or compile-time checks for provider contracts.
- Error normalization tests.

## Acceptance Criteria

- Provider contracts exist in a stable location.
- Mock providers can be used by later UI and worker tasks.
- No long-lived secrets are exposed to client code.
- Domain code does not import vendor SDK types.

## PR Notes

PR title example:

`feat: define AI and storage provider contracts`

