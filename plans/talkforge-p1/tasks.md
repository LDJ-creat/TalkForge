# TalkForge P1 Task Index

## Status Legend

- `todo`: not started
- `in_progress`: active in a development branch
- `done`: merged
- `blocked`: cannot proceed without a dependency or provider decision

## Tasks

| ID | Task | Branch | Depends On | Parallel Group | Status |
|---|---|---|---|---|---|
| P1-001 | Runtime Config And Secrets | `feature/p1-001-runtime-config-secrets` | P0 complete | critical path | todo |
| P1-002 | Real Infrastructure | `feature/p1-002-real-infrastructure` | P1-001 | critical path | todo |
| P1-003 | Object Storage Provider | `feature/p1-003-object-storage-provider` | P1-001, P1-002 | critical path | todo |
| P1-004 | Provider Runtime Resilience | `feature/p1-004-provider-runtime-resilience` | P1-001 | critical path | todo |
| P1-005 | AI Invocation Tracing | `feature/p1-005-ai-invocation-tracing` | P1-001, P1-004 | critical path | todo |
| P1-006 | Realtime Provider Integration | `feature/p1-006-realtime-provider-integration` | P1-001, P1-004, P1-005 | critical path | todo |
| P1-007 | Realtime UI Lifecycle | `feature/p1-007-realtime-ui-lifecycle` | P1-006 | critical path | todo |
| P1-008 | ASR Provider Integration | `feature/p1-008-asr-provider-integration` | P1-003, P1-004, P1-005 | A | todo |
| P1-009 | Text LLM Correction And Report Provider | `feature/p1-009-text-llm-correction-report-provider` | P1-004, P1-005 | A | todo |
| P1-010 | Scenario Progress Judge Provider | `feature/p1-010-scenario-progress-judge-provider` | P1-004, P1-005, P1-009 preferred | A | todo |
| P1-011 | TTS Standard Audio Provider | `feature/p1-011-tts-standard-audio-provider` | P1-003, P1-004, P1-005 | B | todo |
| P1-012 | Shadowing Content Pipeline | `feature/p1-012-shadowing-content-pipeline` | P1-009, P1-011 | B | todo |
| P1-013 | Pronunciation Evaluation Provider | `feature/p1-013-pronunciation-evaluation-provider` | P1-003, P1-004, P1-005, P1-012 | final | todo |
| P1-014 | Observability Cost And Safety | `feature/p1-014-observability-cost-safety` | P1-005 through P1-013 | final | todo |
| P1-015 | Real E2E Staging Readiness | `feature/p1-015-real-e2e-staging-readiness` | P1-001 through P1-014 | final | done |

## Execution Notes

- Keep every task in a separate PR.
- P1-001 through P1-007 form the real conversation critical path.
- P1-005 should be implemented before any real model provider integration, so ASR, LLM, TTS, realtime, and pronunciation calls share one trace layer.
- P1-008, P1-009, and P1-010 can proceed in parallel after provider runtime resilience and AI tracing exist.
- P1-011 and P1-012 can proceed in parallel with the ASR/correction work once storage and LLM provider access are ready.
- P1-015 should be the final readiness PR and must not introduce new feature scope.
