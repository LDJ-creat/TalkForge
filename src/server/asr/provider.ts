import type { AsrProvider } from "@/providers/asr/contract";
import { createProviderError } from "@/providers/errors";
import { createMockAsrProvider } from "@/providers/mock/asr";

let mockAsrProvider: ReturnType<typeof createMockAsrProvider> | undefined;

export function getAsrProvider(): AsrProvider {
  const providerName = process.env.ASR_PROVIDER ?? "mock";

  if (providerName === "mock") {
    mockAsrProvider ??= createMockAsrProvider();
    return mockAsrProvider;
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported ASR provider "${providerName}". P0 supports "mock" only.`,
    retryable: false,
  });
}

export function resetAsrProviderForTests(): void {
  mockAsrProvider = undefined;
}
