import { describe, expect, it, vi } from "vitest";

import type { Correction, CreateCorrectionInput } from "@/domain/correction";
import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import { createMockLlmProvider } from "@/providers/mock/llm";
import { typedEnqueue, createMemoryQueueAdapter } from "@/queue";
import { JobProcessingError } from "@/queue/errors";
import {
  analyzeTurnCorrections,
  getLlmCorrectionProvider,
  resetLlmCorrectionProviderForTests,
  type CorrectionAnalyzeTurnDeps,
} from "@/server/correction";
import {
  createCorrectionAnalyzeHandler,
  createDbCorrectionAnalyzeDeps,
} from "@/workers/handlers/correction-analyze";
import {
  createWorkerRegistry,
  createWorkerRuntime,
  registerP0WorkerHandlers,
} from "@/workers";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_ID = "coffee_ordering_a2";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const TRANSCRIPT_ID = "44444444-4444-4444-8444-444444444444";

const baseSession: Session = {
  id: SESSION_ID,
  userId: "99999999-9999-4999-8999-999999999999",
  scenarioId: SCENARIO_ID,
  realtimeProvider: "mock-realtime",
  status: "active",
  startedAt: "2026-06-06T00:00:00.000Z",
};

const baseScenario: Scenario = {
  id: SCENARIO_ID,
  title: "Order Coffee at a Cafe",
  description: "Practice ordering coffee.",
  level: "A2",
  userRole: "customer",
  aiRole: "barista",
  situation: "A busy cafe counter.",
  mission: "Order a drink politely.",
  goals: [],
  stages: [],
  vocabulary: [],
  targetExpressions: [],
  constraints: ["Stay in character as a customer."],
  exitPolicy: {
    minTurns: 2,
    maxTurns: 12,
    maxDurationSec: 900,
    requiredGoals: [],
    endWhenGoalsCompleted: true,
    allowUserManualEnd: true,
    aiCanSuggestEnd: true,
  },
  evaluationRubric: { dimensions: ["task_completion"] },
};

const baseTurn: Turn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user",
  startedAt: "2026-06-06T00:00:10.000Z",
  endedAt: "2026-06-06T00:00:15.000Z",
  evaluationStatus: "pending",
};

const baseTranscript: Transcript = {
  id: TRANSCRIPT_ID,
  turnId: TURN_ID,
  provider: "mock-asr",
  text: "I go to the cafe yesterday.",
  confidence: 0.94,
  segments: [{ startMs: 0, endMs: 2000, text: "I go to the cafe yesterday." }],
};

const correctionPayload = {
  turnId: TURN_ID,
  sessionId: SESSION_ID,
  transcriptId: TRANSCRIPT_ID,
};

function createInMemoryCorrectionDeps(options?: {
  turn?: Turn | null;
  session?: Session | null;
  scenario?: Scenario | null;
  transcript?: Transcript | null;
  existingCorrections?: Correction[];
  llmProvider?: ReturnType<typeof createMockLlmProvider>;
  depOverrides?: Partial<CorrectionAnalyzeTurnDeps>;
}) {
  const corrections = new Map<string, Correction[]>();
  const transcripts = new Map<string, Transcript>();
  const turns = new Map<string, Turn>();

  if (options?.turn !== null) {
    turns.set(TURN_ID, options?.turn ?? baseTurn);
  }

  const transcript = options?.transcript ?? baseTranscript;
  if (transcript) {
    transcripts.set(TURN_ID, transcript);
  }

  if (options?.existingCorrections?.length) {
    corrections.set(TURN_ID, options.existingCorrections);
  }

  let correctionCounter = 0;

  return {
    deps: {
      llmProvider: options?.llmProvider ?? createMockLlmProvider(),
      getSessionById: async (sessionId: string) =>
        sessionId === SESSION_ID ? (options?.session ?? baseSession) : null,
      getScenarioById: async (scenarioId: string) =>
        scenarioId === SCENARIO_ID ? (options?.scenario ?? baseScenario) : null,
      getTurnById: async (turnId: string) => turns.get(turnId) ?? null,
      listTurnsBySessionId: async (sessionId: string) =>
        sessionId === SESSION_ID ? [...turns.values()] : [],
      getTranscriptById: async (transcriptId: string) => {
        for (const row of transcripts.values()) {
          if (row.id === transcriptId) {
            return row;
          }
        }
        return null;
      },
      getTranscriptByTurnId: async (turnId: string) => transcripts.get(turnId) ?? null,
      getTranscriptsByTurnIds: async (turnIds: string[]) => {
        const result = new Map<string, Transcript>();
        for (const turnId of turnIds) {
          const transcript = transcripts.get(turnId);
          if (transcript) {
            result.set(turnId, transcript);
          }
        }
        return result;
      },
      getCorrectionsByTurnId: async (turnId: string) => corrections.get(turnId) ?? [],
      saveCorrectionsForTurnIfAbsent: async (
        turnId: string,
        inputs: CreateCorrectionInput[],
      ) => {
        const existing = corrections.get(turnId) ?? [];
        if (existing.length > 0) {
          return { corrections: existing, created: false };
        }

        const created = inputs.map((input) => ({
          id: `77777777-7777-4777-8777-${String(correctionCounter++).padStart(12, "0")}`,
          ...input,
        }));
        corrections.set(turnId, created);
        return { corrections: created, created: true };
      },
      ...options?.depOverrides,
    },
    corrections,
    transcripts,
    turns,
  };
}

describe("correction analysis pipeline", () => {
  it("passes a built prompt to the correction provider", async () => {
    const llmProvider = createMockLlmProvider();
    const analyzeSpy = vi.spyOn(llmProvider, "analyzeCorrections");
    const { deps } = createInMemoryCorrectionDeps({ llmProvider });

    await analyzeTurnCorrections(correctionPayload, deps, { attempts: 1 });

    expect(analyzeSpy).toHaveBeenCalledOnce();
    const input = analyzeSpy.mock.calls[0]?.[0];
    expect(input?.prompt?.system).toContain("Do not treat obvious ASR misrecognitions");
    expect(input?.prompt?.user).toContain("I go to the cafe yesterday.");
  });

  it("returns existing corrections when another writer persisted during LLM analysis", async () => {
    const racedCorrection: Correction = {
      id: "88888888-8888-4888-8888-888888888888",
      turnId: TURN_ID,
      type: "grammar",
      originalText: "I go to",
      correctedText: "I went to",
      explanation: "Use past tense.",
      confidence: 0.9,
    };

    const llmProvider = createMockLlmProvider();
    const analyzeSpy = vi.spyOn(llmProvider, "analyzeCorrections");
    const { deps } = createInMemoryCorrectionDeps({
      llmProvider,
      depOverrides: {
        saveCorrectionsForTurnIfAbsent: async () => ({
          corrections: [racedCorrection],
          created: false,
        }),
      },
    });

    const result = await analyzeTurnCorrections(correctionPayload, deps, { attempts: 1 });

    expect(analyzeSpy).toHaveBeenCalledOnce();
    expect(result.created).toBe(false);
    expect(result.corrections).toEqual([racedCorrection]);
  });

  it("rejects invalid provider output missing correctedText", async () => {
    const llmProvider = createMockLlmProvider();
    vi.spyOn(llmProvider, "analyzeCorrections").mockResolvedValue({
      provider: llmProvider.name,
      corrections: [
        {
          type: "grammar",
          originalText: "I go to",
          explanation: "Use past tense.",
          confidence: 0.9,
        },
      ],
    });

    const { deps } = createInMemoryCorrectionDeps({ llmProvider });

    await expect(
      analyzeTurnCorrections(correctionPayload, deps, { attempts: 1 }),
    ).rejects.toMatchObject({
      code: "validation",
      retryable: false,
    });
  });

  it("persists grammar corrections for high-confidence transcripts", async () => {
    const { deps, corrections } = createInMemoryCorrectionDeps();

    const result = await analyzeTurnCorrections(correctionPayload, deps, { attempts: 1 });

    expect(result.created).toBe(true);
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]?.type).toBe("grammar");
    expect(result.corrections[0]?.turnId).toBe(TURN_ID);
    expect(corrections.get(TURN_ID)).toHaveLength(1);
  });

  it("persists asr_uncertain corrections for low-confidence transcripts", async () => {
    const { deps, corrections } = createInMemoryCorrectionDeps({
      transcript: {
        ...baseTranscript,
        text: "maybe latte?",
        confidence: 0.42,
      },
    });

    const result = await analyzeTurnCorrections(correctionPayload, deps, { attempts: 1 });

    expect(result.created).toBe(true);
    expect(result.corrections[0]?.type).toBe("asr_uncertain");
    expect(result.corrections[0]?.correctedText).toBeUndefined();
    expect(corrections.get(TURN_ID)?.[0]?.type).toBe("asr_uncertain");
  });

  it("returns existing corrections without calling the provider again", async () => {
    const existing: Correction = {
      id: "88888888-8888-4888-8888-888888888888",
      turnId: TURN_ID,
      type: "grammar",
      originalText: "I go to",
      correctedText: "I went to",
      explanation: "Use past tense.",
      confidence: 0.9,
    };

    const llmProvider = createMockLlmProvider();
    const analyzeSpy = vi.spyOn(llmProvider, "analyzeCorrections");
    const { deps } = createInMemoryCorrectionDeps({
      llmProvider,
      existingCorrections: [existing],
    });

    const result = await analyzeTurnCorrections(correctionPayload, deps, { attempts: 2 });

    expect(result.created).toBe(false);
    expect(result.corrections).toEqual([existing]);
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it("rejects assistant turns with a non-retryable validation error", async () => {
    const { deps } = createInMemoryCorrectionDeps({
      turn: {
        ...baseTurn,
        role: "assistant",
      },
    });

    await expect(
      analyzeTurnCorrections(correctionPayload, deps, { attempts: 1 }),
    ).rejects.toMatchObject({
      code: "validation",
      retryable: false,
    });
  });

  it("processes correction.analyze jobs through the registered worker handler", async () => {
    const registry = createWorkerRegistry();
    const adapter = createMemoryQueueAdapter({ registry });
    const { deps, corrections } = createInMemoryCorrectionDeps();

    registry.handlers.correctionAnalyze(
      createCorrectionAnalyzeHandler({
        db: {} as never,
        deps,
      }),
    );

    await typedEnqueue.correctionAnalyze(adapter, correctionPayload);

    const runtime = createWorkerRuntime({ adapter, registry });
    const snapshot =
      runtime.mode === "memory" ? await runtime.processNext() : null;

    expect(snapshot?.status).toBe("succeeded");
    expect(corrections.get(TURN_ID)).toHaveLength(1);
  });

  it("maps provider failures to job processing errors", async () => {
    const llmProvider = createMockLlmProvider({ failOnCorrection: true });
    const { deps } = createInMemoryCorrectionDeps({ llmProvider });

    await expect(
      analyzeTurnCorrections(correctionPayload, deps, { attempts: 1 }),
    ).rejects.toBeInstanceOf(JobProcessingError);
  });

  it("defaults to the mock LLM provider through the configuration boundary", () => {
    resetLlmCorrectionProviderForTests();
    process.env.LLM_CORRECTION_PROVIDER = "mock";

    expect(getLlmCorrectionProvider().name).toBe("mock-llm");

    resetLlmCorrectionProviderForTests();
  });

  it("wires database repositories through createDbCorrectionAnalyzeDeps", () => {
    const { deps } = createInMemoryCorrectionDeps();
    const { llmProvider: _ignored, ...repositoryDeps } = deps;

    const dbDeps = createDbCorrectionAnalyzeDeps({
      db: {} as never,
      llmProvider: createMockLlmProvider({ name: "injected-llm" }),
      deps: repositoryDeps,
    });

    expect(dbDeps.llmProvider.name).toBe("injected-llm");
    expect(dbDeps.getCorrectionsByTurnId).toBeTypeOf("function");
  });

  it("registers the correction worker through registerP0WorkerHandlers", () => {
    resetLlmCorrectionProviderForTests();
    process.env.LLM_CORRECTION_PROVIDER = "mock";

    const registry = createWorkerRegistry();

    registerP0WorkerHandlers(registry, {
      db: {} as never,
    });

    expect(registry.listRegisteredJobs()).toContain("correction.analyze");
    expect(registry.listRegisteredJobs()).toContain("asr.transcribe");

    resetLlmCorrectionProviderForTests();
  });
});
