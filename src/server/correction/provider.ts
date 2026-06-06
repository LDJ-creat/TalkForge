import type { LlmCorrectionProvider } from "@/providers/llm/contract";
import { createMockLlmProvider } from "@/providers/mock/llm";

let mockLlmCorrectionProvider: ReturnType<typeof createMockLlmProvider> | undefined;

export function getLlmCorrectionProvider(): LlmCorrectionProvider {
  const providerName = process.env.LLM_CORRECTION_PROVIDER ?? "mock";

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
