import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import { createProviderError } from "@/providers/errors";
import { createMockPronunciationEvaluationProvider } from "@/providers/mock/pronunciation";

let mockPronunciationProvider:
  | ReturnType<typeof createMockPronunciationEvaluationProvider>
  | undefined;

export function getPronunciationProvider(): PronunciationEvaluationProvider {
  const providerName = process.env.PRONUNCIATION_PROVIDER ?? "mock";

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
