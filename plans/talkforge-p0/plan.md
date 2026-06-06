# TalkForge P0 Development Plan

## Goal

Build the P0 foundation for TalkForge: a Next.js + TypeScript AI speaking practice application with structured scenarios, realtime conversation contracts, audio capture/upload, async ASR/correction/evaluation/report pipelines, and clear provider abstractions.

## Source Of Truth

- Design document: `TalkForge-Design.md`
- Agent context: `AGENTS.md`
- Development order: `plans/talkforge-p0/development-order-guide.md`

## P0 Scope

P0 includes:

- Project scaffold and shared TypeScript contracts.
- Database schema for scenarios, sessions, turns, transcripts, audio segments, corrections, evaluations, and reports.
- Structured scenario configuration and prompt generation.
- Realtime provider abstraction and backend token/session creation.
- Conversation UI shell with typed session state.
- Client-side audio recording, turn segmentation, IndexedDB cache, and upload handoff.
- Object storage abstraction for private audio objects.
- Queue/worker infrastructure.
- ASR provider abstraction with mock and external-provider adapter boundary.
- Grammar/expression correction pipeline.
- Free-speech lightweight evaluation and Shadowing contract.
- Session report generation.
- Scenario progress and ending logic.

P0 excludes:

- Self-hosted faster-whisper.
- Full phoneme-level scoring for free conversation.
- Complex user-generated scenarios.
- Teacher/admin dashboards.
- Multi-tenant organization management.

## Task List

Tasks are stored in `plans/talkforge-p0/tasks/`.

Recommended sequence:

1. `TF-001-project-foundation.md`
2. `TF-002-domain-schema.md`
3. `TF-003-scenario-engine.md`
4. `TF-004-provider-contracts.md`
5. Parallel group A:
   - `TF-005-conversation-ui-shell.md`
   - `TF-006-storage-audio-upload.md`
   - `TF-007-queue-worker-foundation.md`
6. Parallel group B:
   - `TF-008-asr-pipeline.md`
   - `TF-009-correction-pipeline.md`
   - `TF-010-pronunciation-shadowing.md`
7. `TF-011-report-generation.md`
8. `TF-012-scenario-progress-ending.md`
9. `TF-013-e2e-integration-hardening.md`

## Milestones

### Milestone 1: Contracts And Foundation

Complete TF-001 through TF-004. The project can compile, core contracts exist, DB schema exists, scenario prompt generation works, and provider interfaces are stable.

### Milestone 2: Conversation And Data Capture

Complete TF-005 through TF-007. Users can start a mock scenario, record a user turn, cache/upload audio, and enqueue processing jobs.

### Milestone 3: Teaching Pipeline

Complete TF-008 through TF-011. Uploaded turns can be transcribed, corrected, lightly evaluated, and summarized in a report.

### Milestone 4: Scenario Control

Complete TF-012 and TF-013. Scenario progress and ending behavior are integrated, and the P0 demo path is coherent.

## Branch Strategy

Use `main` as the base branch unless the repository defines another base branch later.

Each task should be developed on its own branch:

- `feature/tf-001-project-foundation`
- `feature/tf-002-domain-schema`
- `feature/tf-003-scenario-engine`
- etc.

Do not stack dependent branches unless explicitly needed. If stacking is required, state the base branch in the PR description.

