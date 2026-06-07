import type { LlmCorrectionProvider } from "@/providers/llm/contract";
import { getRuntimeConfig } from "@/server/config";
import type { AiInvocationTraceWriter } from "@/server/ai-tracing";

import { getTextLlmProvider, resetTextLlmProviderForTests } from "@/server/llm/text-llm-provider";

export type GetLlmCorrectionProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

export function getLlmCorrectionProvider(
  options?: GetLlmCorrectionProviderOptions,
): LlmCorrectionProvider {
  const providerName = getRuntimeConfig().providers.llmCorrection.name;
  return getTextLlmProvider(providerName, options);
}

export { resetTextLlmProviderForTests as resetLlmCorrectionProviderForTests };
