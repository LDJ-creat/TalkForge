import { afterEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import {
  getRealtimeProvider,
  resetRealtimeProviderForTests,
} from "@/server/realtime/provider";
import { loadRuntimeConfig, resetRuntimeConfigForTests } from "@/server/config";

describe("getRealtimeProvider", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
    resetRealtimeProviderForTests();
    vi.unstubAllGlobals();
    delete process.env.REALTIME_PROVIDER;
    delete process.env.REALTIME_API_KEY;
  });

  it("keeps mock provider available for local tests", () => {
    process.env.REALTIME_PROVIDER = "mock";
    resetRuntimeConfigForTests();

    expect(getRealtimeProvider().name).toBe("mock-realtime");
  });

  it("throws a configuration error for unsupported realtime providers", () => {
    process.env.REALTIME_PROVIDER = "unknown-vendor";
    process.env.REALTIME_API_KEY = "test-key";
    resetRuntimeConfigForTests();

    expect(() => getRealtimeProvider()).toThrow(/Unsupported realtime provider/);
  });

  it("requires REALTIME_API_KEY when qwen-omni is selected", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "test",
        STORAGE_PROVIDER: "mock",
        REALTIME_PROVIDER: "qwen-omni",
      }),
    ).toThrow(/REALTIME_API_KEY is required/);
  });

  it("instantiates qwen-omni provider when configured", () => {
    process.env.REALTIME_PROVIDER = "qwen-omni";
    process.env.REALTIME_API_KEY = "sk-test";
    resetRuntimeConfigForTests();

    expect(getRealtimeProvider().name).toBe("qwen-omni-realtime");
  });

  it("maps token minting failures to normalized provider errors", async () => {
    process.env.REALTIME_PROVIDER = "qwen-omni";
    process.env.REALTIME_API_KEY = "sk-test";
    resetRuntimeConfigForTests();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "InvalidApiKey",
            message: "Invalid API-key provided.",
          }),
          { status: 401 },
        ),
      ),
    );

    await expect(
      getRealtimeProvider().createSession({
        userId: "user-1",
        sessionId: "session-1",
        scenarioId: coffeeOrderingScenario.id,
        systemInstructions: "Stay in character.",
      }),
    ).rejects.toMatchObject({
      code: "authentication",
      provider: "qwen-omni-realtime",
    });
  });
});
