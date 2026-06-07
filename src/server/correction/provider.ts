import type { LlmCorrectionProvider } from "@/providers/llm/contract";
import { createMockLlmProvider } from "@/providers/mock/llm";
import { getRuntimeConfig } from "@/server/config";

let mockLlmCorrectionProvider: ReturnType<typeof createMockLlmProvider> | undefined;

export function getLlmCorrectionProvider(): LlmCorrectionProvider {
  const providerName = getRuntimeConfig().providers.llmCorrection.name;

  if (providerName === "mock") {
    mockLlmCorrectionProvider ??= createMockLlmProvider();
    return mockLlmCorrectionProvider;
  }

  throw new Error(
    `Unsupported LLM correction provider "${providerName}". P0 supports "mock" only.`,
  );
}

export function resetLlmCorrectionProviderForTests(): void {
  mockLlmCorrectionProvider = undefined;
}
