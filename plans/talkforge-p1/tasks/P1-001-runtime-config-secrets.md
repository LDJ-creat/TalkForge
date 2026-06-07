# P1-001 Runtime Config And Secrets

## Branch

`feature/p1-001-runtime-config-secrets`

## Context

P0 uses mock providers. P1 will call real realtime, ASR, LLM, TTS, pronunciation evaluation, storage, database, and queue services. Before any real integration, the app needs typed runtime configuration, environment validation, and secret hygiene.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/plan.md`

## Goal

Add a validated runtime configuration layer for real provider credentials and feature flags.

## Scope

Implement:

- Typed env/config module.
- Validation at server startup/build-safe boundaries.
- `.env.example` or equivalent documentation.
- Feature flags for mock vs real providers.
- Provider selection config for:
  - realtime
  - ASR
  - text LLM
  - TTS
  - pronunciation evaluation
  - object storage
  - database
  - Redis/queue
- Secret access rules that prevent client-side leakage.

Do not implement:

- Real provider API calls.
- Provider-specific SDK logic.
- UI changes beyond safe error display if existing patterns require it.

## Implementation Notes

- Validate required env variables only when the corresponding provider is enabled.
- Use explicit config names, for example `REALTIME_PROVIDER`, `ASR_PROVIDER`, `STORAGE_PROVIDER`.
- Public client env variables must never contain secrets.
- Add a clear startup error when real mode is enabled but required config is missing.

## Tests

- Unit tests for config validation.
- Tests for mock mode requiring no real secrets.
- Tests for real provider mode requiring the correct env variables.
- `npm run build`
- `npm run test`

## Acceptance Criteria

- App can run in mock mode without real secrets.
- App fails fast with a clear error when real mode is misconfigured.
- No long-lived secret is exposed through client-side config.
- Future P1 provider tasks can read config from one stable module.

## PR Notes

PR title example:

`feat: add typed runtime config for real providers`

