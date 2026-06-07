import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRuntimeConfigForTests } from "@/server/config";
import { resetQueueAdapterForTests } from "@/server/queue/provider";
import {
  assertBullMQWorkerRuntime,
  startBullMQWorkerProcess,
} from "@/workers/start-bullmq-worker";

const mockWorkerClose = vi.fn();
const mockQueueClose = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/asr/provider", () => ({
  getAsrProvider: () => ({ name: "mock-asr" }),
  resetAsrProviderForTests: vi.fn(),
}));

vi.mock("@/server/correction/provider", () => ({
  getLlmCorrectionProvider: () => ({ name: "mock-llm" }),
  resetLlmCorrectionProviderForTests: vi.fn(),
}));

vi.mock("@/server/report/provider", () => ({
  getLlmReportProvider: () => ({ name: "mock-llm" }),
  resetLlmReportProviderForTests: vi.fn(),
}));

vi.mock("@/server/scenario-progress/provider", () => ({
  getGoalJudgeProvider: () => ({ name: "mock-llm" }),
  resetGoalJudgeProviderForTests: vi.fn(),
}));

vi.mock("@/server/pronunciation/provider", () => ({
  getFreeSpeechPronunciationProvider: () => ({ name: "mock-pronunciation" }),
  getShadowingPronunciationProvider: () => ({ name: "mock-pronunciation" }),
  getPronunciationProvider: () => ({ name: "mock-pronunciation" }),
  resetPronunciationProviderForTests: vi.fn(),
}));

vi.mock("bullmq", () => {
  class MockQueue {
    close = mockQueueClose;
    add = vi.fn();
    getJob = vi.fn();
  }

  class MockWorker {
    close = mockWorkerClose;
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
  };
});

function withEnv(overrides: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("QUEUE_") ||
      key === "REDIS_URL" ||
      key === "NODE_ENV" ||
      key === "STORAGE_PROVIDER"
    ) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, {
    NODE_ENV: "test",
    STORAGE_PROVIDER: "mock",
    ...overrides,
  });
}

describe("BullMQ worker boot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRuntimeConfigForTests();
    resetQueueAdapterForTests();
  });

  it("rejects worker startup when queue provider is memory", () => {
    withEnv({});

    expect(() => assertBullMQWorkerRuntime()).toThrow(/QUEUE_PROVIDER="redis"/);
  });

  it("starts and stops a BullMQ worker process in redis mode", async () => {
    withEnv({
      QUEUE_PROVIDER: "redis",
      REDIS_URL: "redis://127.0.0.1:6379",
    });

    const processHandle = startBullMQWorkerProcess();

    expect(processHandle.worker).toBeDefined();

    await processHandle.stop();

    expect(mockWorkerClose).toHaveBeenCalled();
    expect(mockQueueClose).toHaveBeenCalled();
  });
});
