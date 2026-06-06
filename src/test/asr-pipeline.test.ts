import { describe, expect, it, vi } from "vitest";

import type { AudioSegment } from "@/domain/audio-segment";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import { createMockAsrProvider } from "@/providers/mock/asr";
import {
  createMemoryQueueAdapter,
  typedEnqueue,
} from "@/queue";
import { JobProcessingError } from "@/queue/errors";
import { getAsrProvider, resetAsrProviderForTests } from "@/server/asr/provider";
import { transcribeTurnAudio } from "@/server/asr/transcribe-turn";
import {
  createAsrTranscribeHandler,
  createDbAsrTranscribeDeps,
} from "@/workers/handlers/asr-transcribe";
import {
  createWorkerRegistry,
  createWorkerRuntime,
  registerP0WorkerHandlers,
} from "@/workers";

const TRANSCRIPT_ID = "44444444-4444-4444-8444-444444444444";
const TRANSCRIPT_ID_2 = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_KEY = "audio/sessions/session-1/turn-1.webm";

const asrPayload = {
  turnId: TURN_ID,
  sessionId: SESSION_ID,
  audioSegmentId: AUDIO_SEGMENT_ID,
  audioObjectKey: OBJECT_KEY,
  language: "en" as const,
};

const baseTurn: Turn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user",
  startedAt: "2026-06-06T00:00:00.000Z",
  endedAt: "2026-06-06T00:00:05.000Z",
  audioSegmentId: AUDIO_SEGMENT_ID,
  evaluationStatus: "pending",
};

const baseAudioSegment: AudioSegment = {
  id: AUDIO_SEGMENT_ID,
  turnId: TURN_ID,
  objectKey: OBJECT_KEY,
  format: "webm",
  codec: "opus",
  durationMs: 5000,
  sizeBytes: 4096,
  createdAt: "2026-06-06T00:00:05.000Z",
};

function createInMemoryAsrDeps(options?: {
  turn?: Turn | null;
  audioSegment?: AudioSegment | null;
  existingTranscript?: Transcript | null;
  asrProvider?: ReturnType<typeof createMockAsrProvider>;
  queueAdapter?: ReturnType<typeof createMemoryQueueAdapter>;
}) {
  const transcripts = new Map<string, Transcript>();
  const turns = new Map<string, Turn>();

  if (options?.turn !== null) {
    turns.set(TURN_ID, options?.turn ?? baseTurn);
  }

  if (options?.existingTranscript) {
    transcripts.set(TURN_ID, options.existingTranscript);
  }

  let transcriptCounter = 0;
  const transcriptIds = [TRANSCRIPT_ID, TRANSCRIPT_ID_2];

  return {
    deps: {
      asrProvider: options?.asrProvider ?? createMockAsrProvider(),
      queueAdapter: options?.queueAdapter,
      getTurnById: async (turnId: string) => turns.get(turnId) ?? null,
      getAudioSegmentById: async (audioSegmentId: string) => {
        if (options?.audioSegment === null) {
          return null;
        }
        if (options?.audioSegment) {
          return options.audioSegment;
        }
        return audioSegmentId === AUDIO_SEGMENT_ID ? baseAudioSegment : null;
      },
      getTranscriptByTurnId: async (turnId: string) => transcripts.get(turnId) ?? null,
      persistTranscriptForTurn: async (input: Omit<Transcript, "id">) => {
        const existing = transcripts.get(input.turnId);
        if (existing) {
          return { transcript: existing, created: false };
        }

        const transcript: Transcript = {
          id:
            transcriptIds[transcriptCounter] ??
            `66666666-6666-4666-8666-${String(transcriptCounter).padStart(12, "0")}`,
          ...input,
        };
        transcriptCounter += 1;
        transcripts.set(input.turnId, transcript);

        const turn = turns.get(input.turnId);
        if (turn) {
          turns.set(input.turnId, { ...turn, transcriptText: input.text });
        }

        return { transcript, created: true };
      },
    },
    transcripts,
    turns,
  };
}

describe("ASR transcription pipeline", () => {
  it("transcribes uploaded audio through the mock provider and persists a transcript", async () => {
    const asrProvider = createMockAsrProvider();
    asrProvider.setTranscript(OBJECT_KEY, {
      text: "Could I get a medium latte, please?",
      confidence: 0.94,
      segments: [
        {
          startMs: 0,
          endMs: 2200,
          text: "Could I get a medium latte, please?",
          words: [
            {
              word: "Could",
              startMs: 0,
              endMs: 250,
              confidence: 0.95,
            },
          ],
        },
      ],
    });

    const { deps, transcripts, turns } = createInMemoryAsrDeps({ asrProvider });

    const result = await transcribeTurnAudio(asrPayload, deps, { attempts: 1 });

    expect(result.created).toBe(true);
    expect(result.transcript.text).toBe("Could I get a medium latte, please?");
    expect(result.transcript.confidence).toBe(0.94);
    expect(result.transcript.provider).toBe("mock-asr");
    expect(result.transcript.segments[0]?.words).toHaveLength(1);
    expect(transcripts.get(TURN_ID)).toEqual(result.transcript);
    expect(turns.get(TURN_ID)?.transcriptText).toBe("Could I get a medium latte, please?");
  });

  it("returns the existing transcript without creating duplicates on retry", async () => {
    const existingTranscript: Transcript = {
      id: TRANSCRIPT_ID,
      turnId: TURN_ID,
      provider: "mock-asr",
      text: "Already transcribed.",
      confidence: 0.9,
      segments: [{ startMs: 0, endMs: 1000, text: "Already transcribed." }],
    };

    const asrProvider = createMockAsrProvider();
    const transcribeSpy = vi.spyOn(asrProvider, "transcribe");
    const { deps, transcripts } = createInMemoryAsrDeps({
      asrProvider,
      existingTranscript,
    });

    const result = await transcribeTurnAudio(asrPayload, deps, { attempts: 2 });

    expect(result.created).toBe(false);
    expect(result.transcript).toEqual(existingTranscript);
    expect(transcribeSpy).not.toHaveBeenCalled();
    expect(transcripts.size).toBe(1);
    expect(result.downstreamJobsEnqueued).toBe(false);
  });

  it("re-enqueues downstream jobs when a transcript already exists", async () => {
    const existingTranscript: Transcript = {
      id: TRANSCRIPT_ID,
      turnId: TURN_ID,
      provider: "mock-asr",
      text: "Already transcribed.",
      confidence: 0.9,
      segments: [{ startMs: 0, endMs: 1000, text: "Already transcribed." }],
    };

    const registry = createWorkerRegistry();
    const downstream: string[] = [];

    registry.handlers.correctionAnalyze(async (payload) => {
      downstream.push(`correction:${payload.transcriptId}`);
    });
    registry.handlers.evaluationFreeSpeech(async (payload) => {
      downstream.push(`evaluation:${payload.audioSegmentId}`);
    });
    registry.handlers.scenarioProgressEvaluate(async (payload) => {
      downstream.push(`progress:${payload.sessionId}`);
    });

    const adapter = createMemoryQueueAdapter({ registry });
    const { deps } = createInMemoryAsrDeps({
      existingTranscript,
      queueAdapter: adapter,
    });

    const result = await transcribeTurnAudio(asrPayload, deps, { attempts: 2 });

    expect(result.created).toBe(false);
    expect(result.downstreamJobsEnqueued).toBe(true);

    const runtime = createWorkerRuntime({ adapter, registry });
    if (runtime.mode === "memory") {
      await runtime.processAll(3);
    }

    expect(downstream).toEqual([
      `correction:${TRANSCRIPT_ID}`,
      `evaluation:${AUDIO_SEGMENT_ID}`,
      `progress:${SESSION_ID}`,
    ]);
  });

  it("fails with a non-retryable error when the audio segment is missing", async () => {
    const { deps } = createInMemoryAsrDeps({ audioSegment: null });

    await expect(
      transcribeTurnAudio(asrPayload, deps, { attempts: 1 }),
    ).rejects.toMatchObject({
      code: "not_found",
      retryable: false,
      message: expect.stringContaining("Audio segment"),
    });
  });

  it("enqueues correction and evaluation jobs after successful transcription", async () => {
    const registry = createWorkerRegistry();
    const downstream: string[] = [];

    registry.handlers.correctionAnalyze(async (payload) => {
      downstream.push(`correction:${payload.transcriptId}`);
    });
    registry.handlers.evaluationFreeSpeech(async (payload) => {
      downstream.push(`evaluation:${payload.audioSegmentId}`);
    });
    registry.handlers.scenarioProgressEvaluate(async (payload) => {
      downstream.push(`progress:${payload.sessionId}`);
    });

    const adapter = createMemoryQueueAdapter({ registry });
    const { deps } = createInMemoryAsrDeps({ queueAdapter: adapter });

    const result = await transcribeTurnAudio(asrPayload, deps, { attempts: 1 });

    expect(result.downstreamJobsEnqueued).toBe(true);

    const runtime = createWorkerRuntime({ adapter, registry });
    const processed =
      runtime.mode === "memory" ? await runtime.processAll(3) : [];

    expect(processed).toHaveLength(3);
    expect(processed.every((job) => job.status === "succeeded")).toBe(true);
    expect(downstream).toEqual([
      `correction:${TRANSCRIPT_ID}`,
      `evaluation:${AUDIO_SEGMENT_ID}`,
      `progress:${SESSION_ID}`,
    ]);
  });

  it("does not enqueue scenario progress for assistant turns", async () => {
    const registry = createWorkerRegistry();
    const downstream: string[] = [];

    registry.handlers.correctionAnalyze(async (payload) => {
      downstream.push(`correction:${payload.transcriptId}`);
    });
    registry.handlers.evaluationFreeSpeech(async (payload) => {
      downstream.push(`evaluation:${payload.audioSegmentId}`);
    });
    registry.handlers.scenarioProgressEvaluate(async (payload) => {
      downstream.push(`progress:${payload.sessionId}`);
    });

    const adapter = createMemoryQueueAdapter({ registry });
    const assistantTurn: Turn = {
      ...baseTurn,
      role: "assistant",
    };
    const { deps } = createInMemoryAsrDeps({
      turn: assistantTurn,
      queueAdapter: adapter,
    });

    await transcribeTurnAudio(asrPayload, deps, { attempts: 1 });

    const runtime = createWorkerRuntime({ adapter, registry });
    if (runtime.mode === "memory") {
      await runtime.processAll(2);
    }

    expect(downstream).toEqual([
      `correction:${TRANSCRIPT_ID}`,
      `evaluation:${AUDIO_SEGMENT_ID}`,
    ]);
  });

  it("processes asr.transcribe jobs through the registered worker handler", async () => {
    const registry = createWorkerRegistry();
    const adapter = createMemoryQueueAdapter({ registry });
    const { deps, transcripts } = createInMemoryAsrDeps();

    registry.handlers.asrTranscribe(
      createAsrTranscribeHandler({
        db: {} as never,
        deps,
      }),
    );

    await typedEnqueue.asrTranscribe(adapter, asrPayload);

    const runtime = createWorkerRuntime({ adapter, registry });
    const snapshot =
      runtime.mode === "memory" ? await runtime.processNext() : null;

    expect(snapshot?.status).toBe("succeeded");
    expect(transcripts.get(TURN_ID)?.text).toContain("Mock transcript for");
  });

  it("maps provider not_found failures to non-retryable job errors", async () => {
    const asrProvider = createMockAsrProvider({
      missingObjectKeys: new Set([OBJECT_KEY]),
    });
    const { deps } = createInMemoryAsrDeps({ asrProvider });

    await expect(
      transcribeTurnAudio(asrPayload, deps, { attempts: 1 }),
    ).rejects.toBeInstanceOf(JobProcessingError);

    await expect(
      transcribeTurnAudio(asrPayload, deps, { attempts: 1 }),
    ).rejects.toMatchObject({
      code: "not_found",
      retryable: false,
    });
  });

  it("defaults to the mock ASR provider through the configuration boundary", () => {
    resetAsrProviderForTests();
    process.env.ASR_PROVIDER = "mock";

    expect(getAsrProvider().name).toBe("mock-asr");
  });

  it("throws a configuration provider error for unsupported ASR providers", () => {
    resetAsrProviderForTests();
    process.env.ASR_PROVIDER = "unsupported-vendor";

    expect(() => getAsrProvider()).toThrow(/Unsupported ASR provider/);

    resetAsrProviderForTests();
    process.env.ASR_PROVIDER = "mock";
  });

  it("wires database repositories through createDbAsrTranscribeDeps", () => {
    const dbDeps = createDbAsrTranscribeDeps({
      db: {} as never,
      asrProvider: createMockAsrProvider({ name: "injected-asr" }),
    });

    expect(dbDeps.asrProvider.name).toBe("injected-asr");
    expect(dbDeps.persistTranscriptForTurn).toBeTypeOf("function");
  });

  it("registers the ASR worker through registerP0WorkerHandlers", () => {
    resetAsrProviderForTests();
    process.env.ASR_PROVIDER = "mock";

    const registry = createWorkerRegistry();

    registerP0WorkerHandlers(registry, {
      db: {} as never,
    });

    expect(registry.listRegisteredJobs()).toContain("asr.transcribe");
    expect(registry.listRegisteredJobs()).toContain("correction.analyze");
    expect(registry.listRegisteredJobs()).toContain("evaluation.freeSpeech");
    expect(registry.listRegisteredJobs()).toContain("scenarioProgress.evaluate");
  });
});
