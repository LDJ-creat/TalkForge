import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { getRuntimeConfig } from "@/server/config";

import {
  getTextLlmScenarioGenerateProvider,
  resetTextLlmScenarioGenerateProviderForTests,
} from "@/server/llm/scenario-generate-provider";
import type { LlmScenarioGenerateProvider } from "@/providers/llm/contract";

export type GetScenarioGenerateProviderOptions = {
  traceWriter?: AiInvocationTraceWriter;
};

export function getScenarioGenerateProvider(
  options?: GetScenarioGenerateProviderOptions,
): LlmScenarioGenerateProvider {
  const providerName = getRuntimeConfig().providers.llmScenarioGenerate.name;
  return getTextLlmScenarioGenerateProvider(providerName, options);
}

export function resetScenarioGenerateProviderForTests(): void {
  resetTextLlmScenarioGenerateProviderForTests();
}
