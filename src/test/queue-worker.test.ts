import { describe, expect, it } from "vitest";

import {
  createJobStatusQuery,
  createMemoryQueueAdapter,
  enqueueCorrectionAnalyzeJob,
  enqueueEvaluationFreeSpeechJob,
  isTerminalJobStatus,
  JobProcessingError,
  normalizeJobError,
  typedEnqueue,
} from "@/queue";
import {
  createWorkerRegistry,
  createWorkerRuntime,
  runMockWorkerCycle,
} from "@/workers";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";
const TRANSCRIPT_ID = "44444444-4444-4444-8444-444444444444";

const asrPayload = {
  turnId: TURN_ID,
  sessionId: SESSION_ID,
  audioSegmentId: AUDIO_SEGMENT_ID,
  audioObjectKey: "sessions/session-1/turn-1.webm",
} as const;

describe("queue worker foundation", () => {
  it("enqueues typed jobs and processes them with registered workers", async () => {
    const registry = createWorkerRegistry();
    const processed: string[] = [];

    registry.handlers.asrTranscribe(async (payload) => {
      processed.push(payload.turnId);
    });
    registry.handlers.correctionAnalyze(async (payload) => {
      processed.push(`correction:${payload.turnId}`);
    });

    const adapter = createMemoryQueueAdapter({ registry });
    const runtime = createWorkerRuntime({ adapter, registry });
    expect(runtime.mode).toBe("memory");

    await typedEnqueue.asrTranscribe(adapter, asrPayload);
    await enqueueCorrectionAnalyzeJob(adapter, {
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      transcriptId: TRANSCRIPT_ID,
    });

    const results =
      runtime.mode === "memory" ? await runtime.processAll() : [];

    expect(results).toHaveLength(2);
    expect(results.every((job) => job.status === "succeeded")).toBe(true);
    expect(processed).toEqual([TURN_ID, `correction:${TURN_ID}`]);
  });

  it("exposes job status through the query helper", async () => {
    const registry = createWorkerRegistry();
    registry.handlers.reportGenerate(async () => {});

    const adapter = createMemoryQueueAdapter({ registry });
    const statusQuery = createJobStatusQuery(adapter);

    const job = await typedEnqueue.reportGenerate(adapter, {
      sessionId: SESSION_ID,
    });

    expect(job.status).toBe("pending");
    expect(isTerminalJobStatus(job.status)).toBe(false);

    await runMockWorkerCycle({ adapter, registry, limit: 1 });

    const updated = await statusQuery.getJob(job.id);
    expect(updated?.status).toBe("succeeded");
    expect(isTerminalJobStatus(updated!.status)).toBe(true);
  });

  it("rejects invalid payloads at enqueue time", async () => {
    const adapter = createMemoryQueueAdapter();

    await expect(
      typedEnqueue.asrTranscribe(adapter, {
        ...asrPayload,
        turnId: "not-a-uuid",
      }),
    ).rejects.toMatchObject({
      code: "validation",
      retryable: false,
    });
  });

  it("marks missing handlers as failed with normalized metadata", async () => {
    const adapter = createMemoryQueueAdapter();
    const runtime = createWorkerRuntime({
      adapter,
      registry: createWorkerRegistry(),
    });

    await enqueueEvaluationFreeSpeechJob(adapter, {
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
    });

    const result =
      runtime.mode === "memory" ? await runtime.processNext() : null;
    expect(result?.status).toBe("failed");
    expect(result?.error?.code).toBe("handler_missing");
    expect(result?.error?.retryable).toBe(false);
  });

  it("retries generic failures until max attempts are exhausted", async () => {
    let attempts = 0;
    const registry = createWorkerRegistry();

    registry.handlers.asrTranscribe(async () => {
      attempts += 1;
      throw new Error("Temporary upstream failure.");
    });

    const adapter = createMemoryQueueAdapter({
      registry,
      config: { defaultMaxAttempts: 3, defaultBackoffDelayMs: 0 },
      now: () => new Date("2026-06-06T00:00:00.000Z"),
    });
    const runtime = createWorkerRuntime({ adapter, registry });

    const job = await typedEnqueue.asrTranscribe(adapter, asrPayload);
    expect(job.maxAttempts).toBe(3);

    const snapshots = [];
    while (snapshots.length < 4) {
      const snapshot =
        runtime.mode === "memory" ? await runtime.processNext() : null;
      if (!snapshot) {
        break;
      }
      snapshots.push(snapshot);
    }

    expect(attempts).toBe(3);
    expect(snapshots.at(-1)?.status).toBe("failed");
    expect(snapshots.at(-1)?.error?.code).toBe("internal");
  });

  it("does not retry explicitly non-retryable JobProcessingError", async () => {
    let attempts = 0;
    const registry = createWorkerRegistry();

    registry.handlers.asrTranscribe(async () => {
      attempts += 1;
      throw new JobProcessingError({
        code: "validation",
        message: "Invalid transcript state.",
        attempts: 1,
        retryable: false,
      });
    });

    const adapter = createMemoryQueueAdapter({ registry });
    const runtime = createWorkerRuntime({ adapter, registry });

    await typedEnqueue.asrTranscribe(adapter, asrPayload);
    const snapshot =
      runtime.mode === "memory" ? await runtime.processNext() : null;

    expect(attempts).toBe(1);
    expect(snapshot?.status).toBe("failed");
    expect(snapshot?.error?.code).toBe("validation");
  });

  it("normalizes unknown worker failures", () => {
    const normalized = normalizeJobError(new Error("Audio segment not found"), {
      attempts: 1,
    });

    expect(normalized.code).toBe("not_found");
    expect(normalized.message).toContain("not found");
  });
});
