import type { ProviderErrorCode } from "@/providers/errors";

export type ProviderCallLogInput = {
  provider: string;
  operation: string;
  latencyMs: number;
  status: "success" | "error";
  retryCount: number;
  errorCode?: ProviderErrorCode | string;
  costEstimate?: number;
  sessionId?: string;
  turnId?: string;
  jobId?: string;
};

function formatContext(context: Record<string, unknown>): string {
  if (Object.keys(context).length === 0) {
    return "";
  }
  return ` ${JSON.stringify(context)}`;
}

function classifyProviderErrorCode(code?: ProviderErrorCode | string): string {
  switch (code) {
    case "configuration":
      return "provider_configuration";
    case "authentication":
      return "provider_authentication";
    case "authorization":
      return "provider_authorization";
    case "rate_limited":
      return "provider_rate_limit";
    case "timeout":
      return "provider_timeout";
    case "provider_unavailable":
      return "provider_unavailable";
    case "invalid_request":
    case "not_found":
      return "provider_invalid_request";
    default:
      return "internal";
  }
}

export function logProviderCall(input: ProviderCallLogInput): void {
  console.info(
    `[talkforge:provider] call${formatContext({
      provider: input.provider,
      operation: input.operation,
      latencyMs: input.latencyMs,
      status: input.status,
      retryCount: input.retryCount,
      errorCode: input.errorCode,
      costEstimate: input.costEstimate,
      sessionId: input.sessionId,
      turnId: input.turnId,
      jobId: input.jobId,
      category: classifyProviderErrorCode(input.errorCode),
    })}`,
  );
}
