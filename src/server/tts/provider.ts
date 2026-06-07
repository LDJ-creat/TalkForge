import type { TtsProvider } from "@/providers/tts/contract";
import { createProviderError } from "@/providers/errors";
import { createMockTtsProvider } from "@/providers/mock/tts";
import { getRuntimeConfig } from "@/server/config";

let mockTtsProvider: ReturnType<typeof createMockTtsProvider> | undefined;

export function getTtsProvider(): TtsProvider {
  const providerName = getRuntimeConfig().providers.tts.name;

  if (providerName === "mock") {
    mockTtsProvider ??= createMockTtsProvider();
    return mockTtsProvider;
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported TTS provider "${providerName}". P0 supports "mock" only.`,
    retryable: false,
  });
}

export function resetTtsProviderForTests(): void {
  mockTtsProvider = undefined;
}
