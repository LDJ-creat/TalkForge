# TalkForge P0 Development Order Guide

## How To Use This Guide

Each task is designed to be executed in a separate development session. Start a new branch, copy the prompt for the target task, and paste it into the new session.

Before implementation, every session should read:

- `AGENTS.md`
- `TalkForge-Design.md`
- The selected task file under `plans/talkforge-p0/tasks/`

## Critical Path

These tasks establish contracts and should happen first:

1. **TF-001 Project Foundation**
   - Branch: `feature/tf-001-project-foundation`
   - Why first: Creates the application structure, tooling, shared type location, and baseline tests.

2. **TF-002 Domain Schema**
   - Branch: `feature/tf-002-domain-schema`
   - Depends on: TF-001
   - Why second: Defines persistence contracts that downstream APIs, workers, and UI depend on.

3. **TF-003 Scenario Engine**
   - Branch: `feature/tf-003-scenario-engine`
   - Depends on: TF-001, TF-002
   - Why third: Defines scenario structure, prompt generation, and P0 seed scenarios.

4. **TF-004 Provider Contracts**
   - Branch: `feature/tf-004-provider-contracts`
   - Depends on: TF-001
   - Why fourth: Defines provider boundaries for realtime, ASR, storage, TTS, and evaluation.

## Parallel Group A

These tasks can run after TF-001 through TF-004 are merged:

- **TF-005 Conversation UI Shell**
  - Branch: `feature/tf-005-conversation-ui-shell`
  - Depends on: TF-003, TF-004

- **TF-006 Storage And Audio Upload**
  - Branch: `feature/tf-006-storage-audio-upload`
  - Depends on: TF-002, TF-004

- **TF-007 Queue Worker Foundation**
  - Branch: `feature/tf-007-queue-worker-foundation`
  - Depends on: TF-002

## Parallel Group B

These can run after TF-006 and TF-007 provide storage and job infrastructure. TF-009 benefits from TF-008 but can start with mocks if needed.

- **TF-008 ASR Pipeline**
  - Branch: `feature/tf-008-asr-pipeline`
  - Depends on: TF-006, TF-007

- **TF-009 Correction Pipeline**
  - Branch: `feature/tf-009-correction-pipeline`
  - Depends on: TF-007, preferably TF-008

- **TF-010 Pronunciation And Shadowing**
  - Branch: `feature/tf-010-pronunciation-shadowing`
  - Depends on: TF-004, TF-006, TF-007

## Final Integration

- **TF-011 Report Generation**
  - Branch: `feature/tf-011-report-generation`
  - Depends on: TF-008, TF-009, TF-010

- **TF-012 Scenario Progress And Ending**
  - Branch: `feature/tf-012-scenario-progress-ending`
  - Depends on: TF-003, TF-005, TF-008

- **TF-013 E2E Integration Hardening**
  - Branch: `feature/tf-013-e2e-integration-hardening`
  - Depends on: TF-005 through TF-012

## Copy-Paste Prompts

### TF-001 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-001-project-foundation.md. Implement only TF-001 on branch feature/tf-001-project-foundation. Keep the PR small and include the required tests and PR notes described in the task file.
```

### TF-002 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-002-domain-schema.md. Implement only TF-002 on branch feature/tf-002-domain-schema. Do not implement UI or provider integrations in this PR.
```

### TF-003 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-003-scenario-engine.md. Implement only TF-003 on branch feature/tf-003-scenario-engine. Focus on structured scenario config, prompt generation, seed scenarios, and tests.
```

### TF-004 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-004-provider-contracts.md. Implement only TF-004 on branch feature/tf-004-provider-contracts. Define stable provider interfaces and mock providers; do not call real external APIs yet.
```

### TF-005 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-005-conversation-ui-shell.md. Implement only TF-005 on branch feature/tf-005-conversation-ui-shell. Build the conversation UI shell and typed state using mocks.
```

### TF-006 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-006-storage-audio-upload.md. Implement only TF-006 on branch feature/tf-006-storage-audio-upload. Focus on audio capture handoff, IndexedDB cache, private object storage abstraction, and upload APIs.
```

### TF-007 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-007-queue-worker-foundation.md. Implement only TF-007 on branch feature/tf-007-queue-worker-foundation. Add queue and worker infrastructure with typed job payloads and tests.
```

### TF-008 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-008-asr-pipeline.md. Implement only TF-008 on branch feature/tf-008-asr-pipeline. Use provider abstraction and mocks; do not hard-code one ASR vendor into domain code.
```

### TF-009 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-009-correction-pipeline.md. Implement only TF-009 on branch feature/tf-009-correction-pipeline. Build transcript-based grammar/expression correction with ASR uncertainty handling.
```

### TF-010 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-010-pronunciation-shadowing.md. Implement only TF-010 on branch feature/tf-010-pronunciation-shadowing. Keep free-speech evaluation separate from Shadowing strong evaluation.
```

### TF-011 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-011-report-generation.md. Implement only TF-011 on branch feature/tf-011-report-generation. Generate session reports from existing transcripts, corrections, evaluations, and scenario goals.
```

### TF-012 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-012-scenario-progress-ending.md. Implement only TF-012 on branch feature/tf-012-scenario-progress-ending. Add scenario progress tracking and ending decisions without making AI-only ending mandatory.
```

### TF-013 Prompt

```text
You are working on TalkForge. Read AGENTS.md, TalkForge-Design.md, and plans/talkforge-p0/tasks/TF-013-e2e-integration-hardening.md. Implement only TF-013 on branch feature/tf-013-e2e-integration-hardening. Wire the P0 demo path end-to-end with mocks and verify the acceptance flow.
```

