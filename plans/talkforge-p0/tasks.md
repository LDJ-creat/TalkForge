# TalkForge P0 Task Index

## Status Legend

- `todo`: not started
- `in_progress`: active in a development branch
- `done`: merged
- `blocked`: cannot proceed without a dependency or decision

## Tasks

| ID | Task | Branch | Depends On | Parallel Group | Status |
|---|---|---|---|---|---|
| TF-001 | Project Foundation | `feature/tf-001-project-foundation` | none | critical path | todo |
| TF-002 | Domain Schema | `feature/tf-002-domain-schema` | TF-001 | critical path | todo |
| TF-003 | Scenario Engine | `feature/tf-003-scenario-engine` | TF-001, TF-002 | critical path | todo |
| TF-004 | Provider Contracts | `feature/tf-004-provider-contracts` | TF-001 | critical path | todo |
| TF-005 | Conversation UI Shell | `feature/tf-005-conversation-ui-shell` | TF-003, TF-004 | A | todo |
| TF-006 | Storage And Audio Upload | `feature/tf-006-storage-audio-upload` | TF-002, TF-004 | A | todo |
| TF-007 | Queue Worker Foundation | `feature/tf-007-queue-worker-foundation` | TF-002 | A | todo |
| TF-008 | ASR Pipeline | `feature/tf-008-asr-pipeline` | TF-006, TF-007 | B | todo |
| TF-009 | Correction Pipeline | `feature/tf-009-correction-pipeline` | TF-007, TF-008 preferred | B | todo |
| TF-010 | Pronunciation And Shadowing | `feature/tf-010-pronunciation-shadowing` | TF-004, TF-006, TF-007 | B | todo |
| TF-011 | Report Generation | `feature/tf-011-report-generation` | TF-008, TF-009, TF-010 | final | todo |
| TF-012 | Scenario Progress And Ending | `feature/tf-012-scenario-progress-ending` | TF-003, TF-005, TF-008 | final | todo |
| TF-013 | E2E Integration Hardening | `feature/tf-013-e2e-integration-hardening` | TF-005 through TF-012 | final | todo |

## Execution Notes

- Keep every task in a separate PR.
- Do not start parallel group A before TF-001 through TF-004 are merged.
- Do not start parallel group B before TF-006 and TF-007 are merged, unless the task explicitly uses mocks to unblock early work.
- TF-013 should be the final integration PR after all core pieces are merged.

