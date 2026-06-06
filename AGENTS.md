# TalkForge Agent Instructions

## Project Context

TalkForge is a Web-based AI English speaking practice product. The core product experience is realtime voice role-play with AI, followed by asynchronous teaching feedback.

The current authoritative design document is:

- `TalkForge-Design.md`

Agents working in new sessions must read this file before implementation. If a task file conflicts with the design document, follow the task file for the current PR and note the discrepancy in the PR description.

## Architecture Summary

TalkForge uses a dual-track architecture:

- **Realtime Track:** Native audio realtime model handles natural voice conversation, interruption, low latency, and role-play.
- **Background Track:** Async workers process user audio and transcript data for ASR, grammar correction, expression improvement, pronunciation evaluation, scenario progress, and reports.

P0 decisions:

- Main stack: Next.js + TypeScript.
- Backend: TypeScript backend first, either Next.js Route Handlers or a dedicated NestJS/Fastify service if the implementation grows.
- ASR: external ASR API first; faster-whisper is a future Python worker, not part of P0.
- Audio storage: IndexedDB temporary client cache + backend object storage for official copies.
- Scenario design: structured scenarios with role, situation, goals, stages, exit policy, and evaluation rubric.
- Scenario ending: manual user end + max duration/turn count + AI suggestion after required goals complete.
- Pronunciation: free conversation gets lightweight evaluation; strict phoneme/word-level evaluation belongs to Shadowing.

## Expected Development Workflow

Use small PRs. Each PR should implement one feature or one contract. Do not combine unrelated infrastructure, UI, API, and worker changes unless the task explicitly requires it.

Recommended branch pattern:

- `feature/tf-001-project-foundation`
- `feature/tf-002-domain-schema`
- `feature/tf-003-scenario-engine`

If the repository has a different naming convention later, follow the repository convention.

## PR Submission Standard

Every PR must be based on adding or modifying a single feature.

Each PR should include:

1. **Title:** One sentence explaining what this PR adds or changes.
2. **Feature Description:** What the feature does and how it is used.
3. **Implementation Approach:** Key technical choices and core logic.
4. **Testing Method:** How to verify the feature works.

Rules:

- One PR does one thing.
- Prefer small PRs with narrow scope.
- Split large features into multiple independent PRs.
- Include tests where practical.
- If tests are not possible yet because the project foundation is incomplete, state the reason and provide manual verification steps.

## Coding Standards

- Use TypeScript for P0 application code.
- Prefer shared domain types for session, scenario, turn, transcript, correction, and evaluation contracts.
- Do not put provider-specific response shapes directly into UI components.
- Use provider abstraction interfaces for realtime, ASR, object storage, TTS, and pronunciation evaluation.
- Persist structured IDs and metadata; avoid storing raw binary audio in PostgreSQL.
- Keep API responses typed and stable.
- Keep tasks scoped. Do not implement future P1/P2 capabilities unless explicitly requested.

## Testing Expectations

Each task should include at least one of:

- Unit tests for pure domain logic.
- Integration tests for API routes or worker handlers.
- Component tests for critical UI behavior.
- Manual verification steps when external services are mocked.

Mock external providers by default in P0 implementation tasks unless the task explicitly asks for real integration.

## Security And Privacy

- Never expose long-lived model, ASR, storage, or TTS API keys to the browser.
- Realtime model access must use backend-created short-lived sessions or tokens.
- Audio objects must be private by default.
- Audio deletion and retention rules must be considered in storage-related tasks.

## CodeGraph

If CodeGraph MCP tools are available in a future implementation session, use them for structural code questions such as definitions, callers, callees, and impact analysis. Use native text search only for literal strings, logs, comments, or when CodeGraph is not initialized.

