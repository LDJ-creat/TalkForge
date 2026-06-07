import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiInvocationOperation } from "@/domain/ai-invocation-log";
import type { AudioSegment } from "@/domain/audio-segment";
import type { Correction } from "@/domain/correction";
import type { PronunciationEvaluation } from "@/domain/pronunciation-evaluation";
import type { Report } from "@/domain/report";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Session } from "@/domain/session";
import type { ShadowingItem } from "@/domain/shadowing";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import {
  createMockAsrProvider,
  createMockGoalJudgeProvider,
  createMockLlmProvider,
  createMockPronunciationEvaluationProvider,
  createMockRealtimeProvider,
  createMockTtsProvider,
} from "@/providers/mock";
import { createMemoryQueueAdapter } from "@/queue";
import {
  createAiInvocationTraceService,
  resetAiInvocationTracingForTests,
} from "@/server/ai-tracing";
import { createTracedAsrProvider } from "@/server/asr/tracing-wrapper";
import { resetRuntimeConfigForTests } from "@/server/config";
import {
  createTracedLlmCorrectionProvider,
  createTracedLlmGoalJudgeProvider,
  createTracedLlmReportProvider,
} from "@/server/llm/tracing-wrapper";
import { createTracedPronunciationProvider } from "@/server/pronunciation/tracing-wrapper";
import { createTracedRealtimeProvider } from "@/server/realtime/tracing-wrapper";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { REPORT_GENERATING_MARKER } from "@/server/report/constants";
import { fetchSessionReportForUser } from "@/server/report";
import {
  completeSessionForUser,
  createCompleteSessionDeps,
  createTurnForUser,
  startSessionForUser,
} from "@/server/session";
import { createTracedTtsProvider } from "@/server/tts/tracing-wrapper";
import {
  createWorkerRegistry,
  createWorkerRuntime,
  registerP0WorkerHandlers,
} from "@/workers";
import { createAsrTranscribeHandler } from "@/workers/handlers/asr-transcribe";
import { createCorrectionAnalyzeHandler } from "@/workers/handlers/correction-analyze";
import { createEvaluationFreeSpeechHandler } from "@/workers/handlers/evaluation-free-speech";
import { createEvaluationShadowingHandler } from "@/workers/handlers/evaluation-shadowing";
import { createReportGenerateHandler } from "@/workers/handlers/report-generate";
import { createScenarioProgressEvaluateHandler } from "@/workers/handlers/scenario-progress-evaluate";
import { createShadowingGenerateHandler } from "@/workers/handlers/shadowing-generate";

const USER_ID = "99999999-9999-4999-8999-999999999999";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_KEY = `audio/${SESSION_ID}/${TURN_ID}.webm`;

const TRACE_CONFIG = {
  enabled: true,
  captureRawRequest: true,
  captureRawResponse: true,
  rawStorageBackend: "file" as const,
  sampleRate: 1,
  retentionDays: 30,
  redactPii: true,
  localRoot: ".storage/ai-traces",
};

function createInMemoryTraceDb() {
  const rows: Array<Record<string, unknown>> = [];

  return {
    rows,
    db: {
      insert: () => ({
        values: (input: Record<string, unknown>) => ({
          returning: async () => {
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

function createP1LoopState() {
  const nowIso = new Date().toISOString();

  const session: Session = {
    id: SESSION_ID,
    userId: USER_ID,
    scenarioId: coffeeOrderingScenario.id,
    realtimeProvider: "mock-realtime",
    status: "active",
    startedAt: nowIso,
  };

  const turns: Turn[] = [];
  const transcripts = new Map<string, Transcript>();
  const corrections = new Map<string, Correction[]>();
  const evaluations = new Map<string, PronunciationEvaluation>();
  const audioSegments = new Map<string, AudioSegment>();
  let progress: ScenarioProgress = {
    sessionId: SESSION_ID,
    currentStageId: "greeting",
    completedGoalIds: [],
    missingGoalIds: coffeeOrderingScenario.goals.map((goal) => goal.id),
    shouldSuggestEnding: false,
    offTopic: false,
    updatedAt: "2026-06-06T00:00:00.000Z",
  };
  let report: Report | null = null;
  const shadowingItems: ShadowingItem[] = [];

  return {
    session,
    turns,
    transcripts,
    corrections,
    evaluations,
    audioSegments,
    shadowingItems,
    getProgress: () => progress,
    getReport: () => report,
    setSession(next: Session) {
      Object.assign(session, next);
    },
    setProgress(next: ScenarioProgress) {
      progress = next;
    },
    setReport(next: Report | null) {
      report = next;
    },
  };
}

describe("P1 real-provider staging readiness (CI-safe mock loop)", () => {
  afterEach(() => {
    resetAiInvocationTracingForTests();
    resetRuntimeConfigForTests();
    vi.restoreAllMocks();
  });

  it("runs the full learning loop and records AI invocation traces", async () => {
    const state = createP1LoopState();
    const traceStore = createInMemoryTraceDb();
    const traceWriter = createAiInvocationTraceService({
      db: traceStore.db as never,
      config: TRACE_CONFIG,
      random: () => 0,
    });

    const mockAsr = createMockAsrProvider();
    mockAsr.setTranscript(OBJECT_KEY, {
      text: "Yesterday I go to the cafe and want a medium latte.",
      confidence: 0.94,
      segments: [
        {
          startMs: 0,
          endMs: 2200,
          text: "Yesterday I go to the cafe and want a medium latte.",
        },
      ],
    });

    const tracedProviders = {
      realtime: createTracedRealtimeProvider(createMockRealtimeProvider(), traceWriter, {
        model: "mock-realtime",
      }),
      asr: createTracedAsrProvider(mockAsr, traceWriter, { model: "mock-asr" }),
      llmCorrection: createTracedLlmCorrectionProvider(
        createMockLlmProvider(),
        traceWriter,
        { model: "mock-llm" },
      ),
      llmReport: createTracedLlmReportProvider(createMockLlmProvider(), traceWriter, {
        model: "mock-llm",
      }),
      llmGoalJudge: createTracedLlmGoalJudgeProvider(
        createMockGoalJudgeProvider(),
        traceWriter,
        { model: "mock-goal-judge" },
      ),
      pronunciation: createTracedPronunciationProvider(
        createMockPronunciationEvaluationProvider(),
        traceWriter,
        { model: "mock-pronunciation" },
      ),
      tts: createTracedTtsProvider(createMockTtsProvider(), traceWriter, {
        model: "mock-tts",
      }),
    };

    const started = await startSessionForUser(USER_ID, coffeeOrderingScenario.id, {
      getScenarioById: async () => coffeeOrderingScenario,
      createSession: async (input) => {
        state.setSession({
          ...state.session,
          ...input,
        });
        return state.session;
      },
      updateRealtimeProviderSessionId: async (sessionId, providerSessionId) => ({
        ...state.session,
        realtimeProviderSessionId: providerSessionId,
      }),
      realtimeProvider: tracedProviders.realtime,
    });

    expect(started.realtimeCredentials.provider).toBe("mock-realtime");

    const userTurn = await createTurnForUser(
      SESSION_ID,
      USER_ID,
      {
        role: "user",
        transcriptText: "Could I get a medium latte with oat milk?",
      },
      {
        getSessionById: async () => state.session,
        getScenarioById: async () => coffeeOrderingScenario,
        listTurnsBySessionId: async () => state.turns,
        createTurn: async (input) => {
          const turn: Turn = {
            id: TURN_ID,
            sessionId: input.sessionId,
            role: input.role,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            transcriptText: input.transcriptText,
            evaluationStatus: input.evaluationStatus ?? "pending",
          };
          state.turns.push(turn);
          return turn;
        },
      },
    );

    expect(userTurn.id).toBe(TURN_ID);

    const audioSegment: AudioSegment = {
      id: AUDIO_SEGMENT_ID,
      turnId: TURN_ID,
      objectKey: OBJECT_KEY,
      format: "webm",
      durationMs: 4200,
      sizeBytes: 8192,
      createdAt: "2026-06-06T00:00:10.000Z",
    };
    state.audioSegments.set(AUDIO_SEGMENT_ID, audioSegment);
    const turnWithAudio = state.turns.find((turn) => turn.id === TURN_ID);
    if (turnWithAudio) {
      turnWithAudio.audioSegmentId = AUDIO_SEGMENT_ID;
    }

    const adapter = createMemoryQueueAdapter();
    const registry = createWorkerRegistry();

    registerP0WorkerHandlers(registry, {
      db: {} as never,
      queueAdapter: adapter,
      asrProvider: tracedProviders.asr,
      llmCorrectionProvider: tracedProviders.llmCorrection,
      llmReportProvider: tracedProviders.llmReport,
      llmGoalJudgeProvider: tracedProviders.llmGoalJudge,
      pronunciationProvider: tracedProviders.pronunciation,
      shadowingPronunciationProvider: tracedProviders.pronunciation,
      ttsProvider: tracedProviders.tts,
    });

    registry.handlers.asrTranscribe(
      createAsrTranscribeHandler({
        db: {} as never,
        queueAdapter: adapter,
        asrProvider: tracedProviders.asr,
        deps: {
          getTurnById: async (turnId) => state.turns.find((turn) => turn.id === turnId) ?? null,
          getAudioSegmentById: async (segmentId) =>
            state.audioSegments.get(segmentId) ?? null,
          getTranscriptByTurnId: async (turnId) => state.transcripts.get(turnId) ?? null,
          persistTranscriptForTurn: async (input) => {
            const existing = state.transcripts.get(input.turnId);
            if (existing) {
              return { transcript: existing, created: false };
            }

            const transcript: Transcript = {
              id: "44444444-4444-4444-8444-444444444444",
              turnId: input.turnId,
              provider: input.provider,
              text: input.text,
              confidence: input.confidence,
              segments: input.segments,
            };
            state.transcripts.set(input.turnId, transcript);
            return { transcript, created: true };
          },
        },
      }),
    );

    registry.handlers.correctionAnalyze(
      createCorrectionAnalyzeHandler({
        db: {} as never,
        llmProvider: tracedProviders.llmCorrection,
        deps: {
          getSessionById: async () => state.session,
          getScenarioById: async () => coffeeOrderingScenario,
          getTurnById: async (turnId) => state.turns.find((turn) => turn.id === turnId) ?? null,
          listTurnsBySessionId: async () => state.turns,
          getTranscriptById: async (transcriptId) =>
            [...state.transcripts.values()].find((item) => item.id === transcriptId) ?? null,
          getTranscriptByTurnId: async (turnId) => state.transcripts.get(turnId) ?? null,
          getTranscriptsByTurnIds: async (turnIds) => {
            const map = new Map<string, Transcript>();
            for (const turnId of turnIds) {
              const transcript = state.transcripts.get(turnId);
              if (transcript) {
                map.set(turnId, transcript);
              }
            }
            return map;
          },
          getCorrectionsByTurnId: async (turnId) => state.corrections.get(turnId) ?? [],
          saveCorrectionsForTurnIfAbsent: async (turnId, inputs) => {
            if ((state.corrections.get(turnId) ?? []).length > 0) {
              return { created: false, corrections: state.corrections.get(turnId) ?? [] };
            }

            const saved = inputs.map((input, index) => ({
              id: `correction-${index + 1}`,
              turnId,
              ...input,
              createdAt: "2026-06-06T00:00:12.000Z",
            }));
            state.corrections.set(turnId, saved);
            return { created: true, corrections: saved };
          },
        },
      }),
    );

    registry.handlers.evaluationFreeSpeech(
      createEvaluationFreeSpeechHandler({
        db: {} as never,
        pronunciationProvider: tracedProviders.pronunciation,
        deps: {
          getTurnById: async (turnId) => state.turns.find((turn) => turn.id === turnId) ?? null,
          getTranscriptByTurnId: async (turnId) => state.transcripts.get(turnId) ?? null,
          getAudioSegmentById: async (segmentId) =>
            state.audioSegments.get(segmentId) ?? null,
          prepareFreeSpeechEvaluation: async () => ({ status: "ready" }),
          markTurnEvaluationFailed: async () => undefined,
          saveFreeSpeechEvaluationForTurnIfAbsent: async (input) => {
            const evaluation: PronunciationEvaluation = {
              id: "eval-free-1",
              turnId: input.turnId,
              mode: input.mode,
              overallScore: input.overallScore,
              fluencyScore: input.fluencyScore,
            };
            state.evaluations.set(input.turnId, evaluation);
            return { created: true, evaluation };
          },
        },
      }),
    );

    registry.handlers.scenarioProgressEvaluate(
      createScenarioProgressEvaluateHandler({
        db: {} as never,
        goalJudgeProvider: tracedProviders.llmGoalJudge,
        deps: {
          getSessionById: async () => state.session,
          getScenarioById: async () => coffeeOrderingScenario,
          getScenarioProgressBySessionId: async () => state.getProgress(),
          listTurnsBySessionId: async () => state.turns,
          getTranscriptsByTurnIds: async (turnIds) => {
            const map = new Map<string, Transcript>();
            for (const turnId of turnIds) {
              const transcript = state.transcripts.get(turnId);
              if (transcript) {
                map.set(turnId, transcript);
              }
            }
            return map;
          },
          upsertScenarioProgress: async (_sessionId, nextProgress) => {
            state.setProgress({
              ...nextProgress,
              updatedAt: "2026-06-06T00:00:13.000Z",
            });
            return state.getProgress();
          },
        },
      }),
    );

    registry.handlers.reportGenerate(
      createReportGenerateHandler({
        db: {} as never,
        queueAdapter: adapter,
        deps: {
          llmProvider: tracedProviders.llmReport,
          getSessionById: async () => state.session,
          getScenarioById: async () => coffeeOrderingScenario,
          getScenarioProgressBySessionId: async () => state.getProgress(),
          listTurnsBySessionId: async () => state.turns,
          getTranscriptsByTurnIds: async (turnIds) => {
            const map = new Map<string, Transcript>();
            for (const turnId of turnIds) {
              const transcript = state.transcripts.get(turnId);
              if (transcript) {
                map.set(turnId, transcript);
              }
            }
            return map;
          },
          getCorrectionsByTurnIds: async (turnIds) => {
            const map = new Map<string, Correction[]>();
            for (const turnId of turnIds) {
              const items = state.corrections.get(turnId);
              if (items) {
                map.set(turnId, items);
              }
            }
            return map;
          },
          getFreeSpeechEvaluationsByTurnIds: async (turnIds) => {
            const map = new Map<string, PronunciationEvaluation>();
            for (const turnId of turnIds) {
              const evaluation = state.evaluations.get(turnId);
              if (evaluation) {
                map.set(turnId, evaluation);
              }
            }
            return map;
          },
          prepareReportGeneration: async (sessionId) => {
            const currentReport = state.getReport();
            if (currentReport && currentReport.summary !== REPORT_GENERATING_MARKER) {
              return { status: "complete", report: currentReport };
            }

            const placeholder: Report = {
              id: "report-1",
              sessionId,
              summary: REPORT_GENERATING_MARKER,
              taskCompletion: { completedGoalIds: [], missingGoalIds: [] },
              keyCorrections: [],
              alternativeExpressions: [],
              shadowingRecommendations: [],
              nextPracticeSuggestion: REPORT_GENERATING_MARKER,
              createdAt: "2026-06-06T00:00:14.000Z",
            };
            state.setReport(placeholder);
            return { status: "claimed", report: placeholder };
          },
          finalizeReport: async (sessionId, input) => {
            const finalized: Report = {
              id: "report-1",
              sessionId,
              createdAt: "2026-06-06T00:00:15.000Z",
              ...input,
            };
            state.setReport(finalized);
            return finalized;
          },
          countReportGenerationAttempts: async () => 0,
        },
      }),
    );

    registry.handlers.shadowingGenerate(
      createShadowingGenerateHandler({
        db: {} as never,
        ttsProvider: tracedProviders.tts,
        deps: {
          ttsProvider: tracedProviders.tts,
          getSessionById: async () => state.session,
          getScenarioById: async () => coffeeOrderingScenario,
          getReportBySessionId: async () => state.getReport(),
          listTurnsBySessionId: async () => state.turns.map((turn) => ({ id: turn.id })),
          getCorrectionsByTurnIds: async (turnIds) => {
            const map = new Map<string, Correction[]>();
            for (const turnId of turnIds) {
              const items = state.corrections.get(turnId);
              if (items) {
                map.set(turnId, items);
              }
            }
            return map;
          },
          prepareShadowingGeneration: async () => ({ status: "claimed" }),
          replaceShadowingItemsForSession: async ({ items }) => {
            state.shadowingItems.splice(
              0,
              state.shadowingItems.length,
              ...items.map((item, index) => ({
                id: `shadowing-item-${index}`,
                sessionId: item.sessionId,
                standardText: item.standardText,
                originalText: item.originalText,
                reason: item.reason,
                source: item.source,
                turnId: item.turnId,
                sortOrder: item.sortOrder,
                standardAudioStatus: item.standardAudioStatus,
                standardAudio: item.standardAudio,
              })),
            );
            return [...state.shadowingItems];
          },
          updateShadowingItemStandardAudio: async (itemId, input) => {
            const index = state.shadowingItems.findIndex((item) => item.id === itemId);
            if (index === -1) {
              return null;
            }

            state.shadowingItems[index] = {
              ...state.shadowingItems[index]!,
              standardAudio: input.standardAudio,
              standardAudioStatus: input.standardAudioStatus,
            };
            return state.shadowingItems[index]!;
          },
        },
      }),
    );

    registry.handlers.evaluationShadowing(
      createEvaluationShadowingHandler({
        db: {} as never,
        pronunciationProvider: tracedProviders.pronunciation,
        deps: {
          getTurnById: async (turnId) => state.turns.find((turn) => turn.id === turnId) ?? null,
          getAudioSegmentById: async (segmentId) =>
            state.audioSegments.get(segmentId) ?? null,
          prepareShadowingEvaluation: async () => ({ status: "ready" }),
          saveShadowingEvaluationForTurnIfAbsent: async (input) => {
            const evaluation: PronunciationEvaluation = {
              id: "eval-shadowing-1",
              turnId: input.turnId,
              mode: input.mode,
              accuracyScore: input.accuracyScore,
              completenessScore: input.completenessScore,
            };
            state.evaluations.set(`${input.turnId}:shadowing`, evaluation);
            return { created: true, evaluation };
          },
        },
      }),
    );

    adapter.registerWorkerRegistry(registry);
    const runtime = createWorkerRuntime({ adapter, registry });

    await adapter.enqueue("asr.transcribe", {
      sessionId: SESSION_ID,
      turnId: TURN_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
      audioObjectKey: OBJECT_KEY,
      language: "en",
    });

    const asrJobs =
      runtime.mode === "memory" ? await runtime.processAll() : [];
    expect(asrJobs.every((job) => job.status === "succeeded")).toBe(true);
    expect(state.transcripts.get(TURN_ID)?.text).toContain("I go to");
    expect(state.corrections.get(TURN_ID)?.length).toBeGreaterThan(0);
    expect(state.evaluations.get(TURN_ID)?.mode).toBe("free_speech");
    expect(state.getProgress().completedGoalIds.length).toBeGreaterThan(0);

    state.setSession({
      ...state.session,
      status: "completed",
      endedAt: "2026-06-06T00:10:00.000Z",
    });

    await completeSessionForUser(
      SESSION_ID,
      USER_ID,
      createCompleteSessionDeps(
        async () => state.session,
        async (sessionId, endedAt) => ({
          ...state.session,
          status: "completed",
          endedAt: endedAt ?? "2026-06-06T00:10:00.000Z",
        }),
        adapter,
      ),
    );

    const completionJobs =
      runtime.mode === "memory" ? await runtime.processAll() : [];
    expect(completionJobs.every((job) => job.status === "succeeded")).toBe(true);
    expect(state.getReport()?.summary).not.toBe(REPORT_GENERATING_MARKER);
    expect(state.shadowingItems.length).toBeGreaterThan(0);
    expect(state.shadowingItems[0]?.standardAudioStatus).toBe("ready");

    await adapter.enqueue("evaluation.shadowing", {
      sessionId: SESSION_ID,
      turnId: TURN_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
      standardText: state.shadowingItems[0]!.standardText,
    });

    const shadowingEvalJobs =
      runtime.mode === "memory" ? await runtime.processAll() : [];
    expect(shadowingEvalJobs.every((job) => job.status === "succeeded")).toBe(true);
    expect(state.evaluations.get(`${TURN_ID}:shadowing`)?.mode).toBe("shadowing");

    const reportView = await fetchSessionReportForUser(SESSION_ID, USER_ID, {
      getSessionById: async () => state.session,
      getReportBySessionId: async () => state.getReport(),
    });

    expect(reportView.summary.length).toBeGreaterThan(0);
    expect(reportView.shadowingRecommendations.length).toBeGreaterThan(0);

    const tracedOperations = traceStore.rows.map(
      (row) => row.operation as AiInvocationOperation,
    );

    expect(tracedOperations).toEqual(
      expect.arrayContaining([
        "realtime.session.create",
        "asr.transcribe",
        "llm.correction",
        "llm.scenarioJudge",
        "llm.report",
        "tts.generate",
        "pronunciation.evaluate",
      ]),
    );
    expect(traceStore.rows.length).toBeGreaterThanOrEqual(7);
  });
});
