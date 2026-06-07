export const AI_INVOCATION_OPERATIONS = [
  "realtime.session.create",
  "asr.transcribe",
  "llm.correction",
  "llm.report",
  "llm.scenarioJudge",
  "tts.generate",
  "pronunciation.evaluate",
] as const;

export type AiInvocationOperation = (typeof AI_INVOCATION_OPERATIONS)[number];

export const AI_INVOCATION_STATUSES = [
  "success",
  "failed",
  "timeout",
  "rate_limited",
] as const;

export type AiInvocationStatus = (typeof AI_INVOCATION_STATUSES)[number];

export type AiInvocationLog = {
  id: string;
  sessionId?: string;
  turnId?: string;
  jobId?: string;
  provider: string;
  model: string;
  operation: AiInvocationOperation;
  promptVersion?: string;
  inputObjectKey?: string;
  outputObjectKey?: string;
  requestSummary?: unknown;
  responseSummary?: unknown;
  /** Prefixed trace reference: `file:{path}` or `object:{objectKey}`. */
  rawRequestObjectKey?: string;
  /** Prefixed trace reference: `file:{path}` or `object:{objectKey}`. */
  rawResponseObjectKey?: string;
  status: AiInvocationStatus;
  latencyMs: number;
  retryCount: number;
  inputTokens?: number;
  outputTokens?: number;
  audioDurationMs?: number;
  costEstimate?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
};

export type CreateAiInvocationLogInput = Omit<AiInvocationLog, "id" | "createdAt">;

export type AiInvocationUsageMetrics = {
  inputTokens?: number;
  outputTokens?: number;
  audioDurationMs?: number;
  costEstimate?: number;
};

export type AiInvocationCountFilter = {
  provider?: string;
  model?: string;
  operation?: AiInvocationOperation;
  sessionId?: string;
  from?: string;
  to?: string;
};
