import type { AsrProvider } from "@/providers/asr/contract";
import { createProviderError } from "@/providers/errors";
import { createMockAsrProvider } from "@/providers/mock/asr";
import { getRuntimeConfig } from "@/server/config";

let mockAsrProvider: ReturnType<typeof createMockAsrProvider> | undefined;

export function getAsrProvider(): AsrProvider {
  const providerName = getRuntimeConfig().providers.asr.name;

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
