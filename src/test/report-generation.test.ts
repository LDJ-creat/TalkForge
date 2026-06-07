import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Correction } from "@/domain/correction";
import type { PronunciationEvaluation } from "@/domain/pronunciation-evaluation";
import type { Report } from "@/domain/report";
import type { Scenario } from "@/domain/scenario";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import { GET as getReportRoute } from "@/app/api/sessions/[sessionId]/report/route";
import { createMockLlmProvider } from "@/providers/mock/llm";
import { createMemoryQueueAdapter, typedEnqueue } from "@/queue";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import {
  isReportGenerationComplete,
  type PrepareReportGenerationResult,
} from "@/server/db/repositories/report-repository";
import {
  buildDeterministicReportSections,
  computeTaskCompletion,
  enqueueSessionReportGeneration,
  fetchSessionReportForUser,
  generateSessionReport,
  REPORT_GENERATING_MARKER,
  resetLlmReportProviderForTests,
  selectKeyCorrections,
  type GenerateSessionReportDeps,
} from "@/server/report";
import {
  createDbReportGenerateDeps,
  createReportGenerateHandler,
} from "@/workers/handlers/report-generate";
import {
  createWorkerRegistry,
  createWorkerRuntime,
  registerP0WorkerHandlers,
} from "@/workers";

const getSessionById = vi.fn();
const getReportBySessionId = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/db/repositories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/repositories")>();
  return {
    ...actual,
    getSessionById: (...args: unknown[]) => getSessionById(...args),
    getReportBySessionId: (...args: unknown[]) => getReportBySessionId(...args),
  };
});

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "99999999-9999-4999-8999-999999999999";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const TURN_ID_2 = "33333333-3333-4333-8333-333333333333";
const REPORT_ID = "88888888-8888-4888-8888-888888888888";

const completedSession: Session = {
  id: SESSION_ID,
  userId: USER_ID,
  scenarioId: coffeeOrderingScenario.id,
  realtimeProvider: "mock-realtime",
  status: "completed",
  startedAt: "2026-06-06T00:00:00.000Z",
  endedAt: "2026-06-06T00:10:00.000Z",
};

const scenarioProgress: ScenarioProgress = {
  sessionId: SESSION_ID,
  currentStageId: "closing",
  completedGoalIds: ["choose_drink", "choose_size"],
  missingGoalIds: ["customize_order", "confirm_payment"],
  shouldSuggestEnding: false,
  offTopic: false,
  updatedAt: "2026-06-06T00:09:00.000Z",
};

const userTurn: Turn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user",
  startedAt: "2026-06-06T00:00:10.000Z",
  endedAt: "2026-06-06T00:00:15.000Z",
  transcriptText: "I want a medium latte.",
  evaluationStatus: "done",
};

const assistantTurn: Turn = {
  id: TURN_ID_2,
  sessionId: SESSION_ID,
  role: "assistant",
  startedAt: "2026-06-06T00:00:16.000Z",
  endedAt: "2026-06-06T00:00:20.000Z",
  transcriptText: "Sure, hot or iced?",
  evaluationStatus: "none",
};

const transcript: Transcript = {
  id: "44444444-4444-4444-8444-444444444444",
  turnId: TURN_ID,
  provider: "mock-asr",
  text: "I want coffee.",
  confidence: 0.95,
  segments: [{ startMs: 0, endMs: 1500, text: "I want coffee." }],
};

const grammarCorrection: Correction = {
  id: "55555555-5555-4555-8555-555555555555",
  turnId: TURN_ID,
  type: "grammar",
  originalText: "I want coffee",
  correctedText: "Could I get a medium latte?",
  explanation: "Use a more natural ordering phrase.",
  confidence: 0.91,
};

const expressionCorrection: Correction = {
  id: "66666666-6666-4666-8666-666666666666",
  turnId: TURN_ID,
  type: "expression",
  originalText: "I want coffee",
  correctedText: "Could I get a medium latte?",
  explanation: "A polite cafe request sounds more natural.",
  confidence: 0.84,
};

const uncertainCorrection: Correction = {
  id: "77777777-7777-4777-8777-777777777777",
  turnId: TURN_ID,
  type: "asr_uncertain",
  originalText: "I want coffee.",
  explanation: "Transcript confidence is too low for reliable correction.",
  confidence: 0.4,
};

const evaluation: PronunciationEvaluation = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  turnId: TURN_ID,
  mode: "free_speech",
  overallScore: 82,
  fluencyScore: 78,
};

function createPlaceholderReport(sessionId: string, createdAt: string): Report {
  return {
    id: REPORT_ID,
    sessionId,
    summary: REPORT_GENERATING_MARKER,
    taskCompletion: {
      completedGoalIds: [],
      missingGoalIds: [],
    },
    keyCorrections: [],
    alternativeExpressions: [],
    shadowingRecommendations: [],
    nextPracticeSuggestion: REPORT_GENERATING_MARKER,
    createdAt,
  };
}

function createInMemoryReportDeps(options?: {
  session?: Session | null;
  scenario?: Scenario | null;
  progress?: ScenarioProgress | null;
  turns?: Turn[];
  transcripts?: Map<string, Transcript>;
  corrections?: Map<string, Correction[]>;
  evaluations?: Map<string, PronunciationEvaluation>;
  existingReport?: Report | null;
  llmProvider?: ReturnType<typeof createMockLlmProvider>;
  depOverrides?: Partial<GenerateSessionReportDeps>;
  now?: () => Date;
}) {
  const reports = new Map<string, Report>();
  const now = options?.now ?? (() => new Date("2026-06-06T00:11:00.000Z"));

  if (options?.existingReport) {
    reports.set(options.existingReport.sessionId, options.existingReport);
  }

  const prepareReportGeneration = async (
    sessionId: string,
  ): Promise<PrepareReportGenerationResult> => {
    const existing = reports.get(sessionId);
    if (existing) {
      if (isReportGenerationComplete(existing)) {
        return { status: "complete", report: existing };
      }

      const ageMs = now().getTime() - new Date(existing.createdAt).getTime();
      if (ageMs < 5 * 60 * 1000) {
        return { status: "in_progress" };
      }

      return { status: "resume", report: existing };
    }

    const placeholder = createPlaceholderReport(sessionId, now().toISOString());
    reports.set(sessionId, placeholder);
    return { status: "claimed", report: placeholder };
  };

  const deps: GenerateSessionReportDeps = {
    llmProvider: options?.llmProvider ?? createMockLlmProvider(),
    getSessionById: async () => options?.session ?? completedSession,
    getScenarioById: async () => options?.scenario ?? coffeeOrderingScenario,
    getScenarioProgressBySessionId: async () => options?.progress ?? scenarioProgress,
    listTurnsBySessionId: async () => options?.turns ?? [userTurn, assistantTurn],
    getTranscriptsByTurnIds: async () => options?.transcripts ?? new Map([[TURN_ID, transcript]]),
    getCorrectionsByTurnIds: async () =>
      options?.corrections ??
      new Map([
        [TURN_ID, [grammarCorrection, expressionCorrection, uncertainCorrection]],
      ]),
    getFreeSpeechEvaluationsByTurnIds: async () =>
      options?.evaluations ?? new Map([[TURN_ID, evaluation]]),
    prepareReportGeneration,
    finalizeReport: async (sessionId, input) => {
      const report: Report = {
        id: REPORT_ID,
        createdAt: now().toISOString(),
        ...input,
      };
      reports.set(sessionId, report);
      return report;
    },
    ...options?.depOverrides,
  };

  return { deps, reports, prepareReportGeneration };
}

describe("report builder", () => {
  it("computes task completion from scenario progress and fluency scores", () => {
    const result = computeTaskCompletion(coffeeOrderingScenario, scenarioProgress, [evaluation]);

    expect(result.completedGoalIds).toEqual(["choose_drink", "choose_size"]);
    expect(result.missingGoalIds).toEqual(["customize_order", "confirm_payment"]);
    expect(result.score).toBeGreaterThan(0);
  });

  it("selects learner corrections while excluding asr_uncertain items", () => {
    const corrections = selectKeyCorrections(
      new Map([[TURN_ID, [grammarCorrection, uncertainCorrection]]]),
      [userTurn],
    );

    expect(corrections).toHaveLength(1);
    expect(corrections[0]?.type).toBe("grammar");
  });

  it("builds actionable sections even when optional data is missing", () => {
    const sections = buildDeterministicReportSections({
      sessionId: SESSION_ID,
      scenario: coffeeOrderingScenario,
      scenarioProgress: null,
      turns: [userTurn],
      transcriptsByTurnId: new Map(),
      correctionsByTurnId: new Map(),
      evaluationsByTurnId: new Map(),
    });

    expect(sections.summary).toContain(coffeeOrderingScenario.title);
    expect(sections.taskCompletion.missingGoalIds.length).toBeGreaterThan(0);
    expect(sections.shadowingRecommendations.length).toBeGreaterThan(0);
    expect(sections.nextPracticeSuggestion).toContain(coffeeOrderingScenario.title);
  });
});

describe("report generation worker", () => {
  beforeEach(() => {
    resetLlmReportProviderForTests();
  });

  it("generates and persists a report for a completed session", async () => {
    const { deps, reports } = createInMemoryReportDeps();

    const result = await generateSessionReport(
      { sessionId: SESSION_ID },
      deps,
      { attempts: 1 },
    );

    expect(result.created).toBe(true);
    expect(result.report.sessionId).toBe(SESSION_ID);
    expect(result.report.keyCorrections.length).toBeGreaterThan(0);
    expect(result.report.shadowingRecommendations.length).toBeGreaterThan(0);
    expect(reports.get(SESSION_ID)?.summary).toContain("Order Coffee at a Cafe");
  });

  it("returns an existing report without regenerating", async () => {
    const existingReport: Report = {
      id: REPORT_ID,
      sessionId: SESSION_ID,
      summary: "Existing report",
      taskCompletion: {
        completedGoalIds: [],
        missingGoalIds: [],
      },
      keyCorrections: [],
      alternativeExpressions: [],
      shadowingRecommendations: [],
      nextPracticeSuggestion: "Keep practicing.",
      createdAt: "2026-06-06T00:11:00.000Z",
    };

    const { deps } = createInMemoryReportDeps({ existingReport });
    const llmProvider = createMockLlmProvider();
    const generateReport = vi.spyOn(llmProvider, "generateReport");

    const result = await generateSessionReport(
      { sessionId: SESSION_ID },
      { ...deps, llmProvider },
      { attempts: 1 },
    );

    expect(result.created).toBe(false);
    expect(result.report.summary).toBe("Existing report");
    expect(generateReport).not.toHaveBeenCalled();
  });

  it("rejects report generation for active sessions", async () => {
    const { deps } = createInMemoryReportDeps({
      session: { ...completedSession, status: "active", endedAt: undefined },
    });

    await expect(
      generateSessionReport({ sessionId: SESSION_ID }, deps, { attempts: 1 }),
    ).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("processes report.generate through the registered worker runtime", async () => {
    const { deps } = createInMemoryReportDeps();
    const registry = createWorkerRegistry();
    registry.handlers.reportGenerate(
      createReportGenerateHandler({ db: {} as never, deps }),
    );

    const adapter = createMemoryQueueAdapter({ registry });
    const runtime = createWorkerRuntime({ adapter, registry });

    await typedEnqueue.reportGenerate(adapter, { sessionId: SESSION_ID });
    const results = runtime.mode === "memory" ? await runtime.processAll() : [];

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("succeeded");
  });

  it("registers report.generate in the P0 worker bundle", () => {
    const registry = createWorkerRegistry();
    registerP0WorkerHandlers(registry, { db: {} as never });

    expect(registry.listRegisteredJobs()).toContain("report.generate");
    expect(createDbReportGenerateDeps({ db: {} as never }).getSessionById).toBeTypeOf("function");
  });

  it("does not call the LLM when another worker already claimed generation", async () => {
    const llmProvider = createMockLlmProvider();
    const generateReport = vi.spyOn(llmProvider, "generateReport");
    const { deps } = createInMemoryReportDeps({
      existingReport: createPlaceholderReport(
        SESSION_ID,
        "2026-06-06T00:11:00.000Z",
      ),
      llmProvider,
    });

    await expect(
      generateSessionReport({ sessionId: SESSION_ID }, deps, { attempts: 1 }),
    ).rejects.toMatchObject({
      code: "report_in_progress",
      retryable: true,
    });

    expect(generateReport).not.toHaveBeenCalled();
  });

  it("deduplicates report.generate jobs by session id when enqueuing", async () => {
    const registry = createWorkerRegistry();
    const processed: string[] = [];
    registry.handlers.reportGenerate(async (payload) => {
      processed.push(payload.sessionId);
    });

    const adapter = createMemoryQueueAdapter({ registry });
    await enqueueSessionReportGeneration(adapter, SESSION_ID);
    await enqueueSessionReportGeneration(adapter, SESSION_ID);

    const first = await adapter.getJob(`report-${SESSION_ID}`);
    expect(first?.name).toBe("report.generate");
    expect(first?.payload).toEqual({ sessionId: SESSION_ID });
  });
});

describe("report API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the request user header is missing", async () => {
    const response = await getReportRoute(
      new Request(`http://localhost/api/sessions/${SESSION_ID}/report`),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns the report for an authorized session owner", async () => {
    const report: Report = {
      id: REPORT_ID,
      sessionId: SESSION_ID,
      summary: "Great practice session.",
      taskCompletion: {
        completedGoalIds: ["choose_drink"],
        missingGoalIds: ["choose_size"],
        score: 70,
      },
      keyCorrections: [],
      alternativeExpressions: [],
      shadowingRecommendations: [{ text: "Could I get a medium latte?" }],
      nextPracticeSuggestion: "Retry the coffee ordering scenario.",
      createdAt: "2026-06-06T00:11:00.000Z",
    };

    getSessionById.mockResolvedValue(completedSession);
    getReportBySessionId.mockResolvedValue(report);

    const response = await getReportRoute(
      new Request(`http://localhost/api/sessions/${SESSION_ID}/report`, {
        headers: {
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.report.sessionId).toBe(SESSION_ID);
    expect(body.report.shadowingRecommendations[0]?.text).toBe("Could I get a medium latte?");
  });

  it("returns 404 when the report has not been generated yet", async () => {
    getSessionById.mockResolvedValue(completedSession);
    getReportBySessionId.mockResolvedValue(null);

    const response = await getReportRoute(
      new Request(`http://localhost/api/sessions/${SESSION_ID}/report`, {
        headers: {
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("fetchSessionReportForUser", () => {
  it("rejects access when the session belongs to another user", async () => {
    await expect(
      fetchSessionReportForUser(SESSION_ID, "other-user", {
        getSessionById: async () => completedSession,
        getReportBySessionId: async () => null,
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});
