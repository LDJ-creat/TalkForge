# P1-009 Text LLM Correction And Report Provider

## Branch

`feature/p1-009-text-llm-correction-report-provider`

## Context

P0 correction and report generation use mocks or deterministic placeholders. P1 needs a real text LLM provider that returns structured, parseable outputs for corrections and report narratives.

Read before implementation:

- `AGENTS.md`
- `TalkForge-Design.md`
- `plans/talkforge-p1/tasks/P1-004-provider-runtime-resilience.md`
- `plans/talkforge-p1/tasks/P1-005-ai-invocation-tracing.md`

## Goal

Integrate a real text LLM provider for grammar/expression correction and report generation.

## Scope

Implement:

- Real text LLM provider adapter.
- Structured correction output schema.
- Structured report output schema.
- Prompt builders for:
  - turn-level correction
  - session-level report narrative
  - alternative expressions
- Output parsing and validation.
- Fallback behavior when LLM output is malformed.

Do not implement:

- Scenario progress judge unless it shares only provider plumbing.
- ASR provider integration.
- UI redesign.

## Implementation Notes

- Verify current official LLM provider docs during implementation.
- Prefer structured output mode if the provider supports it.
- Explicitly instruct the model to distinguish ASR uncertainty from grammar errors.
- Keep prompts versioned or centrally defined.
- Redact or avoid sending unnecessary sensitive metadata.

## Tests

- Prompt builder tests.
- Output schema parsing tests.
- Provider adapter tests using mocked responses.
- Worker tests for correction/report using real-shaped LLM output.

## Acceptance Criteria

- Correction pipeline can call a real LLM provider.
- Report generation can call a real LLM provider.
- Malformed provider output is handled safely.
- Outputs are normalized into existing domain models.

## PR Notes

PR title example:

`feat: integrate real text LLM for corrections and reports`
