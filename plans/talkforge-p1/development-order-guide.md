# TalkForge P1 Development Order Guide

## How To Use This Guide

Each P1 task is intended for a separate development session and a separate PR.

Before starting any P1 task, read:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/plan.md`
- The selected task file under `plans/talkforge-p1/tasks/`

## Worktree Strategy

For serial critical-path tasks, a normal feature branch in the main working tree is usually enough.

For parallel groups, use a dedicated git worktree under `.worktree/` for each task. This keeps branch state, local edits, generated files, and dependency/build artifacts isolated while several tasks are developed at the same time.

Recommended pattern:

```text
.worktree/
  p1-008-asr-provider-integration/
  p1-009-text-llm-correction-report-provider/
  p1-010-scenario-progress-judge-provider/
```

Create a worktree from a stable base branch after the listed dependencies are merged:

```powershell
git worktree add .worktree/p1-008-asr-provider-integration -b feature/p1-008-asr-provider-integration main
```

Rules:

- One task still maps to one branch and one PR.
- Parallel tasks should use separate worktrees.
- Do not share a single worktree across multiple PRs.
- Create worktrees from `main` or the current agreed stable base after dependencies are merged.
- If using a stacked branch, document the base branch in the PR description.
- After the PR is merged, remove the worktree with `git worktree remove .worktree/<name>` and prune if needed.
- `.worktree/` is ignored by git and should not be committed.

## Critical Path

1. **P1-001 Runtime Config And Secrets**
   - Branch: `feature/p1-001-runtime-config-secrets`
   - Why first: Real providers require validated env/config and secret hygiene before integration.

2. **P1-002 Real Infrastructure**
   - Branch: `feature/p1-002-real-infrastructure`
   - Depends on: P1-001
   - Why second: PostgreSQL, Redis, and worker runtime must be real before provider results can be trusted.

3. **P1-003 Object Storage Provider**
   - Branch: `feature/p1-003-object-storage-provider`
   - Depends on: P1-001, P1-002
   - Why third: Real ASR and pronunciation evaluation need real audio object access.

4. **P1-004 Provider Runtime Resilience**
   - Branch: `feature/p1-004-provider-runtime-resilience`
   - Depends on: P1-001
   - Why fourth: All external provider calls need timeout, retry, rate-limit, error normalization, and health-check utilities.

5. **P1-005 AI Invocation Tracing**
   - Branch: `feature/p1-005-ai-invocation-tracing`
   - Depends on: P1-001, P1-004
   - Why fifth: All real model/provider integrations should share one trace layer for raw request/response capture, prompt versions, call counts, latency, usage, and cost estimates.

6. **P1-006 Realtime Provider Integration**
   - Branch: `feature/p1-006-realtime-provider-integration`
   - Depends on: P1-001, P1-004, P1-005
   - Why sixth: Realtime voice is the primary user-facing P1 milestone and should be traced from the first real integration.

7. **P1-007 Realtime UI Lifecycle**
   - Branch: `feature/p1-007-realtime-ui-lifecycle`
   - Depends on: P1-006
   - Why seventh: The UI must handle real connection states, failures, interruption, and fallback.

## Parallel Group A

Can start after P1-003, P1-004, and P1-005 are merged:

- **P1-008 ASR Provider Integration**
  - Branch: `feature/p1-008-asr-provider-integration`
  - Worktree: `.worktree/p1-008-asr-provider-integration`

- **P1-009 Text LLM Correction And Report Provider**
  - Branch: `feature/p1-009-text-llm-correction-report-provider`
  - Worktree: `.worktree/p1-009-text-llm-correction-report-provider`

- **P1-010 Scenario Progress Judge Provider**
  - Branch: `feature/p1-010-scenario-progress-judge-provider`
  - Worktree: `.worktree/p1-010-scenario-progress-judge-provider`
  - Can start with a mock text LLM if P1-009 is not merged, but should be finalized after P1-009.

## Parallel Group B

Can start after P1-003, P1-004, P1-005, and P1-009 are available:

- **P1-011 TTS Standard Audio Provider**
  - Branch: `feature/p1-011-tts-standard-audio-provider`
  - Worktree: `.worktree/p1-011-tts-standard-audio-provider`

- **P1-012 Shadowing Content Pipeline**
  - Branch: `feature/p1-012-shadowing-content-pipeline`
  - Worktree: `.worktree/p1-012-shadowing-content-pipeline`

## Final Group

- **P1-013 Pronunciation Evaluation Provider**
  - Branch: `feature/p1-013-pronunciation-evaluation-provider`
  - Depends on: P1-003, P1-004, P1-005, P1-012

- **P1-014 Observability Cost And Safety**
  - Branch: `feature/p1-014-observability-cost-safety`
  - Depends on: P1-005 and real providers being integrated

- **P1-015 Real E2E Staging Readiness**
  - Branch: `feature/p1-015-real-e2e-staging-readiness`
  - Depends on: all P1 tasks

## Copy-Paste Prompts

### P1-001 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-001-runtime-config-secrets.md. Implement only P1-001 on branch feature/p1-001-runtime-config-secrets. Focus on typed runtime config, env validation, secret hygiene, and documentation. Do not integrate real providers yet.
```

### P1-002 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-002-real-infrastructure.md. Implement only P1-002 on branch feature/p1-002-real-infrastructure. Configure real PostgreSQL/Redis/worker runtime and migrations without changing provider logic.
```

### P1-003 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-003-object-storage-provider.md. Implement only P1-003 on branch feature/p1-003-object-storage-provider. Replace mock storage with a real private object storage provider behind the existing contract.
```

### P1-004 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md. Implement only P1-004 on branch feature/p1-004-provider-runtime-resilience. Add timeout, retry, rate-limit, health-check, and normalized error utilities for external providers.
```

### P1-005 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md. Implement only P1-005 on branch feature/p1-005-ai-invocation-tracing. Add AI invocation tracing for model call counts, prompt versions, raw request/response traces, latency, token/audio usage, cost estimates, and provider output debugging. Do not build a full analytics dashboard.
```

### P1-006 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-006-realtime-provider-integration.md. Implement only P1-006 on branch feature/p1-006-realtime-provider-integration. Integrate one real realtime audio provider through secure backend-issued sessions/tokens, record AI invocation traces, and keep mocks as fallback.
```

### P1-007 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-007-realtime-ui-lifecycle.md. Implement only P1-007 on branch feature/p1-007-realtime-ui-lifecycle. Wire the conversation UI to real realtime lifecycle states, including connecting, connected, interrupted, reconnecting, failed, fallback, and ended.
```

### P1-008 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-008-asr-provider-integration.md. Implement only P1-008. Create or use a dedicated worktree at .worktree/p1-008-asr-provider-integration on branch feature/p1-008-asr-provider-integration, based on main after P1-003, P1-004, and P1-005 are merged. Integrate a real ASR provider behind the existing ASR contract, persist normalized transcripts, and record AI invocation traces. Keep this worktree scoped to this PR only.
```

### P1-009 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-009-text-llm-correction-report-provider.md. Implement only P1-009. Create or use a dedicated worktree at .worktree/p1-009-text-llm-correction-report-provider on branch feature/p1-009-text-llm-correction-report-provider, based on main after P1-003, P1-004, and P1-005 are merged. Integrate a real text LLM provider for structured correction and report generation while preserving parseable outputs and recording AI invocation traces. Keep this worktree scoped to this PR only.
```

### P1-010 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-010-scenario-progress-judge-provider.md. Implement only P1-010. Create or use a dedicated worktree at .worktree/p1-010-scenario-progress-judge-provider on branch feature/p1-010-scenario-progress-judge-provider, based on main after P1-003, P1-004, and P1-005 are merged. Add a real or configurable LLM judge for scenario goal completion and off-topic detection, with deterministic rule fallback and AI invocation tracing. If P1-009 is not merged yet, start with the existing text LLM mock boundary and finalize after P1-009. Keep this worktree scoped to this PR only.
```

### P1-011 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-011-tts-standard-audio-provider.md. Implement only P1-011. Create or use a dedicated worktree at .worktree/p1-011-tts-standard-audio-provider on branch feature/p1-011-tts-standard-audio-provider, based on main after P1-003, P1-004, P1-005, and P1-009 are available. Integrate real TTS standard-audio generation with caching, private object storage, and AI invocation tracing. Keep this worktree scoped to this PR only.
```

### P1-012 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-012-shadowing-content-pipeline.md. Implement only P1-012. Create or use a dedicated worktree at .worktree/p1-012-shadowing-content-pipeline on branch feature/p1-012-shadowing-content-pipeline, based on main after P1-003, P1-004, P1-005, and P1-009 are available. Build the real Shadowing content pipeline from reports and target expressions, using TTS-generated standard audio. If P1-011 is not merged yet, use the existing TTS mock/provider boundary and finalize after P1-011. Keep this worktree scoped to this PR only.
```

### P1-013 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-013-pronunciation-evaluation-provider.md. Implement only P1-013 on branch feature/p1-013-pronunciation-evaluation-provider. Integrate a real pronunciation evaluation provider for Shadowing mode only, including required audio format handling and AI invocation tracing.
```

### P1-014 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-014-observability-cost-safety.md. Implement only P1-014 on branch feature/p1-014-observability-cost-safety. Add provider observability, cost tracking, limits, health checks, and safety fallbacks for real-user readiness using the AI invocation trace layer where possible.
```

### P1-015 Prompt

```text
You are working on TalkForge P1. Read AGENTS.md, TalkForge-Design.md, plans/talkforge-p1/plan.md, and plans/talkforge-p1/tasks/P1-015-real-e2e-staging-readiness.md. Implement only P1-015 on branch feature/p1-015-real-e2e-staging-readiness. Verify and document the complete real-provider staging flow end to end, including AI invocation trace output, without adding new feature scope.
```
