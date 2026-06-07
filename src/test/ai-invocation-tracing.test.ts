import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProviderError } from "@/providers/errors";
import {
  createAiInvocationTraceService,
  executeTracedProviderCall,
  formatRawTraceReference,
  getAiTracingConfig,
  parseRawTraceReference,
  redactTraceValue,
  resetAiInvocationTracingForTests,
  serializeTracePayload,
  shouldCaptureRawRequest,
  shouldCaptureRawResponse,
  shouldSampleAiTrace,
  writeLocalRawTrace,
  writeObjectStorageRawTrace,
  writeRawTraces,
} from "@/server/ai-tracing";
import { loadRuntimeConfig, resetRuntimeConfigForTests } from "@/server/config";
import type { AiTracingConfig } from "@/server/config/types";
import { matchesAiInvocationCountFilter } from "@/server/db/repositories/ai-invocation-log-count-filter";

const BASE_TRACE_CONFIG: AiTracingConfig = {
  enabled: true,
  captureRawRequest: true,
  captureRawResponse: true,
  rawStorageBackend: "file",
  sampleRate: 1,
  retentionDays: 30,
  redactPii: true,
  localRoot: ".storage/ai-traces",
};

function createInMemoryTraceDb(shouldFail = false) {
  const rows: Array<Record<string, unknown>> = [];

  return {
    rows,
    db: {
      insert: () => ({
        values: (input: Record<string, unknown>) => ({
          returning: async () => {
            if (shouldFail) {
              throw new Error("database unavailable");
            }
            const row = {
              ...input,
              createdAt: new Date().toISOString(),
            };
            rows.push(row);
            return [row];
          },
        }),
      }),
    },
  };
}

describe("AI tracing config", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("defaults tracing off in test node env", () => {
    const config = loadRuntimeConfig({
      NODE_ENV: "test",
      STORAGE_PROVIDER: "mock",
    });

    expect(config.aiTracing.enabled).toBe(false);
    expect(config.aiTracing.rawStorageBackend).toBe("file");
  });

  it("parses tracing env overrides", () => {
    const config = loadRuntimeConfig({
      NODE_ENV: "development",
      STORAGE_PROVIDER: "mock",
      AI_TRACING_ENABLED: "true",
      AI_TRACING_RAW_REQUEST: "false",
      AI_TRACING_RAW_RESPONSE: "false",
      AI_TRACING_RAW_STORAGE: "none",
      AI_TRACING_SAMPLE_RATE: "0.5",
      AI_TRACING_RETENTION_DAYS: "14",
      AI_TRACING_REDACT_PII: "false",
      AI_TRACING_LOCAL_ROOT: "/tmp/traces",
    });

    expect(config.aiTracing).toMatchObject({
      enabled: true,
      captureRawRequest: false,
      captureRawResponse: false,
      rawStorageBackend: "none",
      sampleRate: 0.5,
      retentionDays: 14,
      redactPii: false,
      localRoot: "/tmp/traces",
    });
  });

  it("respects sample rate boundaries", () => {
    expect(shouldSampleAiTrace({ ...BASE_TRACE_CONFIG, sampleRate: 1 }, 0.99)).toBe(
      true,
    );
    expect(shouldSampleAiTrace({ ...BASE_TRACE_CONFIG, sampleRate: 0 }, 0)).toBe(
      false,
    );
    expect(
      shouldSampleAiTrace({ ...BASE_TRACE_CONFIG, enabled: false }, 0),
    ).toBe(false);
  });

  it("disables raw capture when storage backend is none", () => {
    const config = {
      ...BASE_TRACE_CONFIG,
      rawStorageBackend: "none" as const,
    };

    expect(shouldCaptureRawRequest(config)).toBe(false);
    expect(shouldCaptureRawResponse(config)).toBe(false);
  });
});

describe("AI trace redaction", () => {
  it("redacts secrets and authorization headers", () => {
    const redacted = redactTraceValue(
      {
        headers: {
          Authorization: "Bearer secret-token",
          "x-api-key": "abc123",
        },
        audioBytes: Buffer.from("fake"),
      },
      true,
    ) as Record<string, unknown>;

    const headers = redacted.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe("[REDACTED]");
    expect(headers["x-api-key"]).toBe("[REDACTED]");
    expect(redacted.audioBytes).toBe("[AUDIO_OMITTED]");
  });

  it("preserves plain string prompts when redactPii is disabled", () => {
    expect(redactTraceValue("hello learner", false)).toBe("hello learner");
    expect(redactTraceValue("Bearer secret-token", false)).toBe("Bearer [REDACTED]");
  });

  it("serializes payloads without leaking bearer tokens", () => {
    const serialized = serializeTracePayload(
      { apiKey: "super-secret", prompt: "hello" },
      true,
    );

    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("super-secret");
    expect(serialized).toContain("hello");
  });
});

describe("raw trace references", () => {
  it("prefixes file and object references consistently", () => {
    expect(formatRawTraceReference("file", "abc/request.json")).toBe(
      "file:abc/request.json",
    );
    expect(formatRawTraceReference("object", "ai-traces/abc/request.json")).toBe(
      "object:ai-traces/abc/request.json",
    );
    expect(parseRawTraceReference("file:abc/request.json")).toEqual({
      backend: "file",
      path: "abc/request.json",
    });
  });
});

describe("local raw trace writer", () => {
  let tempDir: string;

  afterEach(async () => {
    resetAiInvocationTracingForTests();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes redacted raw traces under the configured root", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "talkforge-traces-"));
    const logId = "11111111-1111-4111-8111-111111111111";

    const relativePath = await writeLocalRawTrace({
      rootDir: tempDir,
      logId,
      kind: "request",
      payload: { apiKey: "secret", prompt: "test" },
      redactPii: true,
    });

    const contents = await readFile(path.join(tempDir, relativePath), "utf8");
    expect(relativePath).toBe(`${logId}/request.json`);
    expect(contents).toContain("[REDACTED]");
    expect(contents).not.toContain("secret");
  });

  it("returns prefixed file references when writing raw traces", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "talkforge-traces-"));
    const logId = "22222222-2222-4222-8222-222222222222";

    const result = await writeRawTraces(
      {
        config: {
          ...BASE_TRACE_CONFIG,
          localRoot: tempDir,
        },
      },
      {
        logId,
        rawRequest: { prompt: "hello" },
      },
    );

    expect(result.rawRequestObjectKey).toBe(`file:${logId}/request.json`);
  });

  it("skips raw writes when capture flags are disabled", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "talkforge-traces-"));
    const logId = "33333333-3333-4333-8333-333333333333";

    const result = await writeRawTraces(
      {
        config: {
          ...BASE_TRACE_CONFIG,
          captureRawRequest: false,
          captureRawResponse: false,
          localRoot: tempDir,
        },
      },
      {
        logId,
        rawRequest: { prompt: "hidden" },
        rawResponse: { text: "hidden" },
      },
    );

    expect(result.rawRequestObjectKey).toBeUndefined();
    expect(result.rawResponseObjectKey).toBeUndefined();
  });
});

describe("object storage raw trace writer", () => {
  it("writes JSON payloads and returns object keys", async () => {
    const writes: Array<{ objectKey: string; contentType: string }> = [];
    const storage = {
      writeUploadedObject: vi.fn(async (input) => {
        writes.push({
          objectKey: input.objectKey,
          contentType: input.contentType,
        });
      }),
    };

    const objectKey = await writeObjectStorageRawTrace({
      storage: storage as never,
      logId: "44444444-4444-4444-8444-444444444444",
      kind: "response",
      payload: { apiKey: "secret", text: "ok" },
      redactPii: true,
    });

    expect(objectKey).toBe(
      "ai-traces/44444444-4444-4444-8444-444444444444/response.json",
    );
    expect(storage.writeUploadedObject).toHaveBeenCalledOnce();
    expect(writes[0]?.contentType).toBe("application/json");
  });
});

describe("AI invocation trace service", () => {
  afterEach(() => {
    resetAiInvocationTracingForTests();
    resetRuntimeConfigForTests();
  });

  it("persists summary records to the database", async () => {
    const store = createInMemoryTraceDb();
    const traceWriter = createAiInvocationTraceService({
      db: store.db as never,
      config: BASE_TRACE_CONFIG,
      createId: () => "33333333-3333-4333-8333-333333333333",
      random: () => 0,
    });

    const log = await traceWriter.record({
      provider: "mock-llm",
      model: "gpt-test",
      operation: "llm.correction",
      promptVersion: "correction-v1",
      requestSummary: { turnId: "abc" },
      responseSummary: { items: [] },
      metadata: {
        provider: "mock-llm",
        operation: "llm.correction",
        latencyMs: 42,
        status: "success",
        retryCount: 1,
      },
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        costEstimate: 0.001,
      },
    });

    expect(log).toMatchObject({
      id: "33333333-3333-4333-8333-333333333333",
      provider: "mock-llm",
      model: "gpt-test",
      operation: "llm.correction",
      promptVersion: "correction-v1",
      status: "success",
      latencyMs: 42,
      retryCount: 1,
      inputTokens: 10,
      outputTokens: 20,
      costEstimate: 0.001,
    });
    expect(store.rows).toHaveLength(1);
  });

  it("returns null when tracing is disabled", async () => {
    const store = createInMemoryTraceDb();
    const traceWriter = createAiInvocationTraceService({
      db: store.db as never,
      config: { ...BASE_TRACE_CONFIG, enabled: false },
    });

    const log = await traceWriter.record({
      provider: "mock-asr",
      model: "asr-v1",
      operation: "asr.transcribe",
      metadata: {
        provider: "mock-asr",
        operation: "asr.transcribe",
        latencyMs: 10,
        status: "success",
        retryCount: 0,
      },
    });

    expect(log).toBeNull();
    expect(store.rows).toHaveLength(0);
  });

  it("does not throw when persistence fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createInMemoryTraceDb(true);
    const traceWriter = createAiInvocationTraceService({
      db: store.db as never,
      config: BASE_TRACE_CONFIG,
      random: () => 0,
    });

    const log = await traceWriter.record({
      provider: "mock-llm",
      model: "gpt-test",
      operation: "llm.correction",
      metadata: {
        provider: "mock-llm",
        operation: "llm.correction",
        latencyMs: 10,
        status: "success",
        retryCount: 0,
      },
    });

    expect(log).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("executeTracedProviderCall", () => {
  afterEach(() => {
    resetAiInvocationTracingForTests();
  });

  it("records success traces with usage metadata", async () => {
    const records: unknown[] = [];
    const traceWriter = {
      record: vi.fn(async (input) => {
        records.push(input);
        return {
          id: "trace-1",
          ...input,
          status: "success",
          latencyMs: input.metadata.latencyMs,
          retryCount: input.metadata.retryCount,
          createdAt: new Date().toISOString(),
        };
      }),
    };

    const { result, trace } = await executeTracedProviderCall({
      traceWriter,
      provider: "mock-llm",
      model: "gpt-test",
      operation: "llm.report",
      promptVersion: "report-v2",
      fn: async () => ({ summary: "done" }),
      timeoutMs: 500,
      retry: false,
      extractUsage: () => ({ inputTokens: 100, outputTokens: 50 }),
      extractResponseSummary: (value) => value,
      rawRequest: { sessionId: "session-1" },
      extractRawResponse: (value) => value,
    });

    expect(result.summary).toBe("done");
    expect(trace).toMatchObject({
      provider: "mock-llm",
      operation: "llm.report",
      promptVersion: "report-v2",
    });
    expect(traceWriter.record).toHaveBeenCalledOnce();
    expect(records[0]).toMatchObject({
      metadata: expect.objectContaining({ status: "success" }),
      usage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  it("still returns provider results when trace persistence fails", async () => {
    const traceWriter = {
      record: vi.fn(async () => null),
    };

    const { result, trace } = await executeTracedProviderCall({
      traceWriter,
      provider: "mock-llm",
      model: "gpt-test",
      operation: "llm.report",
      fn: async () => ({ summary: "done" }),
      timeoutMs: 500,
      retry: false,
    });

    expect(result.summary).toBe("done");
    expect(trace).toBeNull();
  });

  it("records failure traces and rethrows provider errors", async () => {
    const traceWriter = {
      record: vi.fn(async (input) => ({
        id: "trace-fail",
        provider: input.provider,
        model: input.model,
        operation: input.operation,
        status: "failed" as const,
        latencyMs: input.metadata.latencyMs,
        retryCount: input.metadata.retryCount,
        createdAt: new Date().toISOString(),
      })),
    };

    await expect(
      executeTracedProviderCall({
        traceWriter,
        provider: "mock-asr",
        model: "asr-v1",
        operation: "asr.transcribe",
        fn: async () => {
          throw createProviderError({
            provider: "mock-asr",
            code: "authentication",
            message: "Invalid API key.",
            retryable: false,
          });
        },
        timeoutMs: 500,
        retry: false,
      }),
    ).rejects.toMatchObject({ code: "authentication" });

    expect(traceWriter.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          status: "error",
          errorCode: "authentication",
        }),
        errorMessage: "Invalid API key.",
      }),
    );
  });
});

describe("getAiTracingConfig", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("reads tracing config from runtime config", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STORAGE_PROVIDER", "mock");
    vi.stubEnv("AI_TRACING_ENABLED", "true");
    resetRuntimeConfigForTests();

    try {
      expect(getAiTracingConfig().enabled).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("AI invocation count filter", () => {
  const rows = [
    {
      provider: "mock-llm",
      model: "gpt-a",
      operation: "llm.correction",
      sessionId: "session-1",
      createdAt: "2026-06-01T10:00:00.000Z",
    },
    {
      provider: "mock-llm",
      model: "gpt-a",
      operation: "llm.report",
      sessionId: "session-1",
      createdAt: "2026-06-01T11:00:00.000Z",
    },
    {
      provider: "mock-asr",
      model: "asr-v1",
      operation: "asr.transcribe",
      sessionId: "session-2",
      createdAt: "2026-06-02T09:00:00.000Z",
    },
  ];

  it("supports filtering by provider, model, operation, session, and date", () => {
    expect(
      rows.filter((row) => matchesAiInvocationCountFilter(row, { provider: "mock-llm" })),
    ).toHaveLength(2);
    expect(
      rows.filter((row) =>
        matchesAiInvocationCountFilter(row, {
          provider: "mock-llm",
          operation: "llm.correction",
          sessionId: "session-1",
        }),
      ),
    ).toHaveLength(1);
    expect(
      rows.filter((row) =>
        matchesAiInvocationCountFilter(row, {
          from: "2026-06-02T00:00:00.000Z",
          to: "2026-06-02T23:59:59.999Z",
        }),
      ),
    ).toHaveLength(1);
  });
});
