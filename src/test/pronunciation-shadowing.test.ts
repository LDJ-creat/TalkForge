import { describe, expect, it, vi } from "vitest";

import {
  assertShadowingStandardText,
  createShadowingItemsFromRecommendations,
  createShadowingItemsFromScenario,
  ShadowingValidationError,
} from "@/domain/shadowing";
import {
  createMockPronunciationEvaluationProvider,
} from "@/providers";
import {
  createMemoryQueueAdapter,
  enqueueEvaluationFreeSpeechJob,
  enqueueEvaluationShadowingJob,
} from "@/queue";
import { getSeedScenarioById } from "@/server/scenario/catalog";
import { evaluateFreeSpeechTurn } from "@/server/pronunciation/evaluate-free-speech";
import { evaluateShadowingTurn } from "@/server/shadowing/evaluate-shadowing-turn";
import {
  evaluateAndSaveShadowingAttempt,
  evaluateShadowingAttempt,
} from "@/server/shadowing/evaluate-shadowing";
import {
  createEvaluationFreeSpeechHandler,
  createEvaluationShadowingHandler,
  createWorkerRegistry,
  createWorkerRuntime,
} from "@/workers";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_KEY = `audio/${SESSION_ID}/${TURN_ID}.webm`;

const baseTurn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user" as const,
  startedAt: "2026-06-06T00:00:00.000Z",
  endedAt: "2026-06-06T00:00:05.000Z",
  audioSegmentId: AUDIO_SEGMENT_ID,
  evaluationStatus: "none" as const,
};

const baseAudioSegment = {
  id: AUDIO_SEGMENT_ID,
  turnId: TURN_ID,
  objectKey: OBJECT_KEY,
  format: "webm" as const,
  durationMs: 5000,
  sizeBytes: 4096,
  createdAt: "2026-06-06T00:00:05.000Z",
};

describe("shadowing item helpers", () => {
  it("creates shadowing items from scenario target expressions", () => {
    const scenario = getSeedScenarioById("coffee_ordering_a2");
    expect(scenario).not.toBeNull();

    const items = createShadowingItemsFromScenario(scenario!);

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.standardText.length > 0)).toBe(true);
    expect(items.every((item) => item.source === "scenario_target_expression")).toBe(
      true,
    );
  });

  it("creates shadowing items from report recommendations", () => {
    const items = createShadowingItemsFromRecommendations([
      { text: "Could I get a medium latte?", reason: "More natural ordering phrase." },
      { text: "   ", reason: "Should be filtered out." },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.standardText).toBe("Could I get a medium latte?");
    expect(items[0]?.source).toBe("report_recommendation");
  });
});

describe("shadowing evaluation", () => {
  it("requires standard text for strong shadowing evaluation", async () => {
    const provider = createMockPronunciationEvaluationProvider();

    await expect(
      evaluateShadowingAttempt(
        {
          audioObjectKey: OBJECT_KEY,
          standardText: "   ",
        },
        { pronunciationProvider: provider },
      ),
    ).rejects.toMatchObject({
      code: "validation",
      message: expect.stringContaining("standard text"),
    });

    const result = await evaluateShadowingAttempt(
      {
        audioObjectKey: OBJECT_KEY,
        standardText: "Could I get a medium latte?",
      },
      { pronunciationProvider: provider },
    );

    expect(result.mode).toBe("shadowing");
    expect(result.accuracyScore).toBeDefined();
    expect(result.completenessScore).toBeDefined();
  });

  it("rejects shadowing provider calls without reference text", async () => {
    const provider = createMockPronunciationEvaluationProvider();

    await expect(
      provider.evaluate({
        audioObjectKey: OBJECT_KEY,
        mode: "shadowing",
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
    });
  });

  it("persists shadowing evaluation results when a turn id is provided", async () => {
    const provider = createMockPronunciationEvaluationProvider();
    const savedInputs: Array<{ mode: string; turnId: string }> = [];

    const result = await evaluateAndSaveShadowingAttempt(
      {
        turnId: TURN_ID,
        audioObjectKey: OBJECT_KEY,
        standardText: "Could I get a medium latte?",
      },
      {
        pronunciationProvider: provider,
        saveShadowingEvaluationForTurnIfAbsent: async (input) => {
          savedInputs.push({ mode: input.mode, turnId: input.turnId });
          return {
            created: true,
            evaluation: {
              id: "shadowing-eval-1",
              turnId: input.turnId,
              mode: input.mode,
              accuracyScore: input.accuracyScore,
              completenessScore: input.completenessScore,
            },
          };
        },
      },
    );

    expect(result.created).toBe(true);
    expect(result.evaluation.mode).toBe("shadowing");
    expect(savedInputs).toEqual([{ mode: "shadowing", turnId: TURN_ID }]);
  });
});

describe("evaluation.shadowing worker", () => {
  it("runs strong shadowing evaluation with reference text", async () => {
    const pronunciationProvider = createMockPronunciationEvaluationProvider();
    const evaluateSpy = vi.spyOn(pronunciationProvider, "evaluate");
    let prepared = false;
    let saved = false;

    const result = await evaluateShadowingTurn(
      {
        turnId: TURN_ID,
        sessionId: SESSION_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
        standardText: "Could I get a medium latte?",
      },
      {
        pronunciationProvider,
        getTurnById: async () => baseTurn,
        getAudioSegmentById: async () => baseAudioSegment,
        prepareShadowingEvaluation: async () => {
          prepared = true;
          return { status: "ready" };
        },
        saveShadowingEvaluationForTurnIfAbsent: async (input) => {
          saved = true;
          return {
            created: true,
            evaluation: {
              id: "shadowing-eval-1",
              turnId: input.turnId,
              mode: input.mode,
              accuracyScore: input.accuracyScore,
              completenessScore: input.completenessScore,
            },
          };
        },
      },
      { attempts: 1, jobId: "job-shadowing-1" },
    );

    expect(result.created).toBe(true);
    expect(result.evaluation.mode).toBe("shadowing");
    expect(prepared).toBe(true);
    expect(saved).toBe(true);
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        audioObjectKey: OBJECT_KEY,
        mode: "shadowing",
        referenceText: "Could I get a medium latte?",
        sessionId: SESSION_ID,
        turnId: TURN_ID,
        jobId: "job-shadowing-1",
      }),
    );
  });

  it("is idempotent for an existing shadowing evaluation", async () => {
    const existing = {
      id: "shadowing-eval-existing",
      turnId: TURN_ID,
      mode: "shadowing" as const,
      accuracyScore: 86,
      completenessScore: 88,
    };

    const result = await evaluateShadowingTurn(
      {
        turnId: TURN_ID,
        sessionId: SESSION_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
        standardText: "Could I get a medium latte?",
      },
      {
        pronunciationProvider: createMockPronunciationEvaluationProvider(),
        getTurnById: async () => baseTurn,
        getAudioSegmentById: async () => baseAudioSegment,
        prepareShadowingEvaluation: async () => ({
          status: "exists",
          evaluation: existing,
        }),
        saveShadowingEvaluationForTurnIfAbsent: async () => {
          throw new Error("Should not create a duplicate evaluation.");
        },
      },
      { attempts: 1 },
    );

    expect(result.created).toBe(false);
    expect(result.evaluation).toEqual(existing);
  });

  it("processes queued jobs through the registered worker handler", async () => {
    const pronunciationProvider = createMockPronunciationEvaluationProvider();
    const registry = createWorkerRegistry();
    const evaluations: string[] = [];

    registry.handlers.evaluationShadowing(
      createEvaluationShadowingHandler({
        db: {} as never,
        pronunciationProvider,
        deps: {
          getTurnById: async () => baseTurn,
          getAudioSegmentById: async () => baseAudioSegment,
          prepareShadowingEvaluation: async () => ({ status: "ready" }),
          saveShadowingEvaluationForTurnIfAbsent: async (input) => {
            evaluations.push(input.turnId);
            return {
              created: true,
              evaluation: {
                id: "shadowing-eval-queued",
                turnId: input.turnId,
                mode: input.mode,
                accuracyScore: input.accuracyScore,
              },
            };
          },
        },
      }),
    );

    const adapter = createMemoryQueueAdapter({ registry });
    const runtime = createWorkerRuntime({ adapter, registry });

    await enqueueEvaluationShadowingJob(adapter, {
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
      standardText: "Could I get a medium latte?",
    });

    const snapshot =
      runtime.mode === "memory" ? await runtime.processNext() : null;

    expect(snapshot?.status).toBe("succeeded");
    expect(evaluations).toEqual([TURN_ID]);
  });
});

describe("evaluation.freeSpeech worker", () => {
  it("runs lightweight mock evaluation without reference text", async () => {
    const pronunciationProvider = createMockPronunciationEvaluationProvider();
    const evaluateSpy = vi.spyOn(pronunciationProvider, "evaluate");
    let prepared = false;
    let saved = false;

    const result = await evaluateFreeSpeechTurn(
      {
        turnId: TURN_ID,
        sessionId: SESSION_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
      },
      {
        pronunciationProvider,
        getTurnById: async () => baseTurn,
        getAudioSegmentById: async () => baseAudioSegment,
        prepareFreeSpeechEvaluation: async () => {
          prepared = true;
          return { status: "ready" };
        },
        saveFreeSpeechEvaluationForTurnIfAbsent: async (input) => {
          saved = true;
          return {
            created: true,
            evaluation: {
              id: "eval-1",
              turnId: input.turnId,
              mode: input.mode,
              fluencyScore: input.fluencyScore,
              overallScore: input.overallScore,
              details: input.details,
            },
          };
        },
        markTurnEvaluationFailed: async () => {
          throw new Error("Should not mark evaluation as failed.");
        },
      },
      { attempts: 1 },
    );

    expect(result.created).toBe(true);
    expect(result.evaluation.mode).toBe("free_speech");
    expect(prepared).toBe(true);
    expect(saved).toBe(true);
    expect(evaluateSpy).toHaveBeenCalledWith({
      audioObjectKey: OBJECT_KEY,
      mode: "free_speech",
      language: "en",
    });
    expect(evaluateSpy.mock.calls[0]?.[0]).not.toHaveProperty("referenceText");
  });

  it("is idempotent for an existing free-speech evaluation", async () => {
    const existing = {
      id: "eval-existing",
      turnId: TURN_ID,
      mode: "free_speech" as const,
      fluencyScore: 70,
    };

    const result = await evaluateFreeSpeechTurn(
      {
        turnId: TURN_ID,
        sessionId: SESSION_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
      },
      {
        pronunciationProvider: createMockPronunciationEvaluationProvider(),
        getTurnById: async () => baseTurn,
        getAudioSegmentById: async () => baseAudioSegment,
        prepareFreeSpeechEvaluation: async () => ({
          status: "exists",
          evaluation: existing,
        }),
        saveFreeSpeechEvaluationForTurnIfAbsent: async () => {
          throw new Error("Should not create a duplicate evaluation.");
        },
        markTurnEvaluationFailed: async () => {
          throw new Error("Should not mark evaluation as failed.");
        },
      },
      { attempts: 1 },
    );

    expect(result.created).toBe(false);
    expect(result.evaluation).toEqual(existing);
  });

  it("processes queued jobs through the registered worker handler", async () => {
    const pronunciationProvider = createMockPronunciationEvaluationProvider();
    const registry = createWorkerRegistry();
    const evaluations: string[] = [];

    registry.handlers.evaluationFreeSpeech(
      createEvaluationFreeSpeechHandler({
        db: {} as never,
        pronunciationProvider,
        deps: {
          getTurnById: async () => baseTurn,
          getAudioSegmentById: async () => baseAudioSegment,
          prepareFreeSpeechEvaluation: async () => ({ status: "ready" }),
          saveFreeSpeechEvaluationForTurnIfAbsent: async (input) => {
            evaluations.push(input.turnId);
            return {
              created: true,
              evaluation: {
                id: "eval-queued",
                turnId: input.turnId,
                mode: input.mode,
                fluencyScore: input.fluencyScore,
              },
            };
          },
          markTurnEvaluationFailed: async () => {},
        },
      }),
    );

    const adapter = createMemoryQueueAdapter({ registry });
    const runtime = createWorkerRuntime({ adapter, registry });

    await enqueueEvaluationFreeSpeechJob(adapter, {
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
    });

    const snapshot =
      runtime.mode === "memory" ? await runtime.processNext() : null;

    expect(snapshot?.status).toBe("succeeded");
    expect(evaluations).toEqual([TURN_ID]);
  });
});

describe("shadowing validation", () => {
  it("throws when standard text is empty", () => {
    expect(() => assertShadowingStandardText("   ")).toThrow(
      ShadowingValidationError,
    );
  });
});
