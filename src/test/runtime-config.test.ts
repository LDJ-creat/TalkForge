import { afterEach, describe, expect, it } from "vitest";

import {
  collectRuntimeConfigIssues,
  findPublicEnvLeaks,
  getPublicClientConfig,
  getRuntimeSecret,
  loadRuntimeConfig,
  parseRuntimeConfigFromEnv,
  resetRuntimeConfigForTests,
  RuntimeConfigError,
  validateRuntimeConfig,
} from "@/server/config";
import { getAsrProvider, resetAsrProviderForTests } from "@/server/asr/provider";

const BASE_MOCK_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  STORAGE_PROVIDER: "mock",
};

function withEnv(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...BASE_MOCK_ENV, ...overrides };
}

describe("runtime config", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
    resetAsrProviderForTests();
  });

  it("allows mock-only mode without provider API secrets", () => {
    const config = loadRuntimeConfig(BASE_MOCK_ENV);

    expect(config.usesOnlyMockProviders).toBe(true);
    expect(config.providers.realtime.mode).toBe("mock");
    expect(config.providers.queue.name).toBe("memory");
    expect(config.secrets.realtimeApiKey).toBeUndefined();
  });

  it("requires realtime secrets when a real realtime provider is selected", () => {
    expect(() =>
      loadRuntimeConfig(
        withEnv({
          REALTIME_PROVIDER: "qwen-omni",
        }),
      ),
    ).toThrow(RuntimeConfigError);

    expect(() =>
      loadRuntimeConfig(
        withEnv({
          REALTIME_PROVIDER: "qwen-omni",
          REALTIME_API_KEY: "test-realtime-key",
        }),
      ),
    ).not.toThrow();
  });

  it("requires redis url when queue provider is redis", () => {
    const issues = collectRuntimeConfigIssues(
      parseRuntimeConfigFromEnv(withEnv({ QUEUE_PROVIDER: "redis" })),
      withEnv({ QUEUE_PROVIDER: "redis" }),
    );

    expect(issues).toContainEqual(
      expect.stringContaining("REDIS_URL is required"),
    );
  });

  it("requires object storage credentials for real storage providers", () => {
    expect(() =>
      loadRuntimeConfig(
        withEnv({
          STORAGE_PROVIDER: "s3",
        }),
      ),
    ).toThrow(RuntimeConfigError);

    expect(() =>
      loadRuntimeConfig(
        withEnv({
          STORAGE_PROVIDER: "s3",
          STORAGE_ENDPOINT: "https://s3.amazonaws.com",
          STORAGE_BUCKET: "talkforge-audio",
          STORAGE_ACCESS_KEY_ID: "access",
          STORAGE_SECRET_ACCESS_KEY: "secret",
        }),
      ),
    ).not.toThrow();
  });

  it("treats local storage as mock-safe infrastructure", () => {
    const config = loadRuntimeConfig(
      withEnv({
        STORAGE_PROVIDER: "local",
      }),
    );

    expect(config.providers.storage.mode).toBe("mock");
    expect(config.providers.storage.name).toBe("local");
  });

  it("falls back LLM report provider to correction provider", () => {
    const config = parseRuntimeConfigFromEnv(
      withEnv({
        LLM_CORRECTION_PROVIDER: "openai",
        LLM_API_KEY: "shared-llm-key",
      }),
    );

    expect(config.providers.llmReport.name).toBe("openai");
    expect(() => validateRuntimeConfig(config, withEnv({
      LLM_CORRECTION_PROVIDER: "openai",
      LLM_API_KEY: "shared-llm-key",
    }))).not.toThrow();
  });

  it("detects secret-like variables exposed through NEXT_PUBLIC_", () => {
    const issues = findPublicEnvLeaks({
      NEXT_PUBLIC_REALTIME_API_KEY: "leaked",
    });

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/must not be exposed to the browser/i);
  });

  it("never exposes secrets through public client config", () => {
    const config = loadRuntimeConfig(
      withEnv({
        REALTIME_API_KEY: "server-only-key",
        LLM_API_KEY: "server-only-llm",
        NEXT_PUBLIC_APP_BASE_URL: "http://localhost:3000",
      }),
    );

    const publicConfig = getPublicClientConfig();
    const serialized = JSON.stringify(publicConfig);

    expect(serialized).not.toContain("server-only-key");
    expect(serialized).not.toContain("server-only-llm");
    expect(publicConfig.appBaseUrl).toBe("http://localhost:3000");
    expect(config.secrets.realtimeApiKey).toBe("server-only-key");
  });

  it("formats validation failures with actionable issue lists", () => {
    try {
      loadRuntimeConfig(withEnv({ ASR_PROVIDER: "openai" }));
      expect.fail("Expected runtime config validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeConfigError);
      const configError = error as RuntimeConfigError;
      expect(configError.issues).toContainEqual(
        expect.stringContaining("ASR_API_KEY is required"),
      );
      expect(configError.message).toMatch(/TalkForge runtime configuration is invalid/i);
    }
  });

  it("wires provider getters through the runtime config boundary", () => {
    process.env.ASR_PROVIDER = "unsupported-vendor";
    process.env.ASR_API_KEY = "test-asr-key";
    resetRuntimeConfigForTests();

    expect(() => getAsrProvider()).toThrow(/Unsupported ASR provider/);

    process.env.ASR_PROVIDER = "mock";
    resetRuntimeConfigForTests();
    expect(getAsrProvider().name).toBe("mock-asr");
  });

  it("reads server secrets only through the server-only accessor", () => {
    const config = loadRuntimeConfig(
      withEnv({
        DATABASE_URL: "postgresql://localhost:5432/talkforge",
      }),
    );

    resetRuntimeConfigForTests();
    process.env.DATABASE_URL = "postgresql://localhost:5432/talkforge";

    expect(getRuntimeSecret("databaseUrl")).toBe(
      "postgresql://localhost:5432/talkforge",
    );
    expect(config.secrets.databaseUrl).toBe(
      "postgresql://localhost:5432/talkforge",
    );
  });
});
