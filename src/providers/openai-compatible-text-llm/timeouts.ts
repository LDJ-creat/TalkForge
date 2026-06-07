/** Session report narrative can exceed 90s on long sessions; align with scenario generation. */
export const TEXT_LLM_REPORT_TIMEOUT_MS = 300_000;

/** Structured scenario JSON can be slow on large/reasoning models; use a conservative limit. */
export const SCENARIO_GENERATE_TIMEOUT_MS = 300_000;
