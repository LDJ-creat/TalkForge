import type { RealtimeProvider } from "@/providers/realtime/contract";
import { createProviderError } from "@/providers/errors";
import { createMockRealtimeProvider } from "@/providers/mock/realtime";

let mockRealtimeProvider: ReturnType<typeof createMockRealtimeProvider> | undefined;

export function getRealtimeProvider(): RealtimeProvider {
  const providerName = process.env.REALTIME_PROVIDER ?? "mock";

  if (providerName === "mock") {
    mockRealtimeProvider ??= createMockRealtimeProvider();
    return mockRealtimeProvider;
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Unsupported realtime provider "${providerName}". P0 supports "mock" only.`,
    retryable: false,
  });
}

export function resetRealtimeProviderForTests(): void {
  mockRealtimeProvider = undefined;
}
