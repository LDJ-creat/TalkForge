import type { LlmReportProvider } from "@/providers/llm/contract";
import { createMockLlmProvider } from "@/providers/mock/llm";

let mockLlmReportProvider: ReturnType<typeof createMockLlmProvider> | undefined;

export function getLlmReportProvider(): LlmReportProvider {
  const providerName = process.env.LLM_REPORT_PROVIDER ?? process.env.LLM_CORRECTION_PROVIDER ?? "mock";

  if (providerName === "mock") {
    mockLlmReportProvider ??= createMockLlmProvider();
    return mockLlmReportProvider;
  }

  throw new Error(
    `Unsupported LLM report provider "${providerName}". P0 supports "mock" only.`,
  );
}

export function resetLlmReportProviderForTests(): void {
  mockLlmReportProvider = undefined;
}
