import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBullMQQueueAdapter } from "@/queue/bullmq-adapter";
import { createWorkerRegistry } from "@/queue/worker-types";
import { createWorkerRuntime } from "@/workers/runtime";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";

const mockQueueAdd = vi.fn();
const mockQueueGetJob = vi.fn();
const mockQueueClose = vi.fn();
const mockWorkerClose = vi.fn();

const queueInstances: Array<{
  queueName: string;
  options: { prefix?: string; connection: { url: string } };
}> = [];

const workerInstances: Array<{
  queueName: string;
  options: { prefix?: string; connection: { url: string } };
}> = [];

vi.mock("bullmq", () => {
  class MockQueue {
    add = mockQueueAdd;
    getJob = mockQueueGetJob;
    close = mockQueueClose;

    constructor(
      queueName: string,
      options: { prefix?: string; connection: { url: string } },
    ) {
      queueInstances.push({ queueName, options });
    }
  }

  class MockWorker {
    close = mockWorkerClose;

    constructor(
      queueName: string,
      _processor: unknown,
      options: { prefix?: string; connection: { url: string } },
    ) {
      workerInstances.push({ queueName, options });
    }
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
  };
});

describe("BullMQ queue adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueInstances.length = 0;
    workerInstances.length = 0;
    mockQueueAdd.mockResolvedValue({ id: "job-1" });
    mockQueueGetJob.mockResolvedValue({
      id: "job-1",
      data: {
        name: "asr.transcribe",
        payload: {
          turnId: TURN_ID,
          sessionId: SESSION_ID,
          audioSegmentId: AUDIO_SEGMENT_ID,
          audioObjectKey: "sessions/session-1/turn-1.webm",
        },
      },
      getState: vi.fn().mockResolvedValue("waiting"),
      attemptsMade: 0,
      opts: { attempts: 3 },
      timestamp: Date.now(),
      processedOn: undefined,
      finishedOn: undefined,
      failedReason: null,
    });
  });

  it("uses separate queue name and redis prefix", async () => {
    const { Queue, Worker } = await import("bullmq");
    const adapter = createBullMQQueueAdapter({
      config: {
        redisUrl: "redis://127.0.0.1:6379",
        prefix: "talkforge",
        queueName: "background-jobs",
      },
      queueFactory: Queue,
      workerFactory: Worker,
    });

    await adapter.enqueue("asr.transcribe", {
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
      audioObjectKey: "sessions/session-1/turn-1.webm",
    });

    expect(queueInstances[0]?.queueName).toBe("background-jobs");
    expect(queueInstances[0]?.options.prefix).toBe("talkforge");
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "asr.transcribe",
      expect.objectContaining({ name: "asr.transcribe" }),
      expect.objectContaining({ attempts: 3 }),
    );

    await adapter.close();
  });

  it("starts a BullMQ worker runtime for production processing", async () => {
    const { Queue, Worker } = await import("bullmq");
    const registry = createWorkerRegistry();
    registry.handlers.asrTranscribe(async () => {});

    const adapter = createBullMQQueueAdapter({
      config: { redisUrl: "redis://127.0.0.1:6379" },
      queueFactory: Queue,
      workerFactory: Worker,
    });

    const runtime = createWorkerRuntime({ adapter, registry });
    expect(runtime.mode).toBe("bullmq");

    if (runtime.mode === "bullmq") {
      runtime.start();
      expect(workerInstances[0]?.queueName).toBe("background-jobs");
      await runtime.stop();
    }

    expect(mockWorkerClose).toHaveBeenCalled();
    expect(mockQueueClose).toHaveBeenCalled();
  });
});
