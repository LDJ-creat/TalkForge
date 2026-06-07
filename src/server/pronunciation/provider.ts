import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import { createProviderError } from "@/providers/errors";
import { createMockPronunciationEvaluationProvider } from "@/providers/mock/pronunciation";
import { getRuntimeConfig } from "@/server/config";

let mockPronunciationProvider:
  | ReturnType<typeof createMockPronunciationEvaluationProvider>
  | undefined;

export function getPronunciationProvider(): PronunciationEvaluationProvider {
  const providerName = getRuntimeConfig().providers.pronunciation.name;

  if (providerName === "mock") {
    mockPronunciationProvider ??= createMockPronunciationEvaluationProvider();
    return mockPronunciationProvider;
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported pronunciation provider "${providerName}". P0 supports "mock" only.`,
    retryable: false,
  });
}

export function resetPronunciationProviderForTests(): void {
  mockPronunciationProvider = undefined;
}
