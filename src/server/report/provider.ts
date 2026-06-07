import type { LlmReportProvider } from "@/providers/llm/contract";
import { getRuntimeConfig } from "@/server/config";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";

import { getTextLlmProvider, resetTextLlmProviderForTests } from "@/server/llm/text-llm-provider";

export type GetLlmReportProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

export function getLlmReportProvider(
  options?: GetLlmReportProviderOptions,
): LlmReportProvider {
  const providerName = getRuntimeConfig().providers.llmReport.name;
  return getTextLlmProvider(providerName, options);
}

export { resetTextLlmProviderForTests as resetLlmReportProviderForTests };
