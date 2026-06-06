# TF-001 Project Foundation

## Branch

`feature/tf-001-project-foundation`

## Context

TalkForge P0 uses Next.js + TypeScript as the main application stack. This first task creates the repository foundation that later PRs depend on.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p0/plan.md`

## Goal

Create the initial app structure, TypeScript configuration, lint/test tooling, and shared source organization for TalkForge.

## Scope

Implement:

- Next.js + TypeScript application scaffold.
- Package scripts for `dev`, `build`, `lint`, `test`, and type checking.
- Shared folders for domain contracts, server code, provider abstractions, workers, and UI.
- Baseline test setup.
- Basic app landing route that makes it clear this is the TalkForge P0 app shell.

Do not implement:

- Database schema.
- Realtime model integration.
- Audio recording.
- ASR/correction/evaluation pipelines.

## Suggested Structure

```text
src/
  app/
  components/
  domain/
  server/
  providers/
  workers/
  lib/
  test/
```

## Implementation Notes

- Prefer the current stable Next.js TypeScript setup.
- Use a test runner appropriate for the stack, such as Vitest.
- Add path aliases if useful, for example `@/domain`.
- Keep the initial UI minimal.

## Tests

- `npm run lint`
- `npm run test`
- `npm run build`

## Acceptance Criteria

- Project installs and builds.
- Test runner executes at least one baseline test.
- Source directories are ready for follow-up PRs.
- No external provider keys or real API calls are introduced.

## PR Notes

PR title example:

`feat: scaffold TalkForge Next.js foundation`

PR description must include feature description, implementation approach, and testing method.

