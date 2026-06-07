import { afterEach, describe, expect, it, vi } from "vitest";

import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import { createOpenAiCompatibleTextLlmProvider } from "@/providers/openai-compatible-text-llm";
import type { CorrectionAnalyzePayload } from "@/queue/payloads";
import type { ReportGeneratePayload } from "@/queue/payloads";
import { analyzeTurnCorrections } from "@/server/correction/analyze-turn";
import { generateSessionReport } from "@/server/report/generate-session-report";
import { REPORT_GENERATING_MARKER } from "@/server/report/constants";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";

const originalFetch = global.fetch;

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const TRANSCRIPT_ID = "44444444-4444-4444-8444-444444444444";

const baseSession: Session = {
  id: SESSION_ID,
  userId: "99999999-9999-4999-8999-999999999999",
  scenarioId: coffeeOrderingScenario.id,
  realtimeProvider: "mock-realtime",
  status: "active",
  startedAt: "2026-06-06T00:00:00.000Z",
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
  text: "Yesterday I go to the cafe.",
  confidence: 0.95,
  segments: [{ startMs: 0, endMs: 2000, text: "Yesterday I go to the cafe." }],
};

describe("text LLM worker integration", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("persists corrections from real-shaped LLM output", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: JSON.stringify({
                corrections: [
                  {
                    type: "grammar",
                    originalText: "I go to",
                    correctedText: "I went to",
                    explanation: "Use past tense.",
                    confidence: 0.9,
                  },
                ],
              }),
            },
          },
        ],
      }),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const payload: CorrectionAnalyzePayload = {
      sessionId: SESSION_ID,
      turnId: TURN_ID,
      transcriptId: TRANSCRIPT_ID,
    };

    const result = await analyzeTurnCorrections(
      payload,
      {
        llmProvider: provider,
        getSessionById: async () => baseSession,
        getScenarioById: async () => coffeeOrderingScenario,
        getTurnById: async () => baseTurn,
        listTurnsBySessionId: async () => [baseTurn],
        getTranscriptById: async () => baseTranscript,
        getTranscriptByTurnId: async () => null,
        getTranscriptsByTurnIds: async () => new Map([[TURN_ID, baseTranscript]]),
        getCorrectionsByTurnId: async () => [],
        saveCorrectionsForTurnIfAbsent: async (_turnId, inputs) => ({
          created: true,
          corrections: inputs.map((input, index) => ({
            id: `correction-${index + 1}`,
            ...input,
            createdAt: "2026-06-07T00:00:00.000Z",
          })),
        }),
      },
      { attempts: 1 },
    );

    expect(result.created).toBe(true);
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]?.correctedText).toBe("I went to");
  });

  it("merges real-shaped report narrative output into the generated report", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "LLM summary for the session.",
                nextPracticeSuggestion: "LLM next step.",
                alternativeExpressions: [
                  {
                    original: "I want coffee.",
                    suggestion: "Could I get a coffee, please?",
                  },
                ],
                shadowingRecommendations: [
                  { text: "Could I get a coffee, please?" },
                ],
              }),
            },
          },
        ],
      }),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const payload: ReportGeneratePayload = { sessionId: SESSION_ID };

    const result = await generateSessionReport(
      payload,
      {
        llmProvider: provider,
        getSessionById: async () => ({
          ...baseSession,
          status: "completed",
          endedAt: "2026-06-06T00:10:00.000Z",
        }),
        getScenarioById: async () => coffeeOrderingScenario as Scenario,
        getScenarioProgressBySessionId: async () => ({
          sessionId: SESSION_ID,
          currentStageId: "closing",
          completedGoalIds: ["choose_drink"],
          missingGoalIds: [],
          shouldSuggestEnding: true,
          offTopic: false,
          updatedAt: "2026-06-06T00:10:00.000Z",
        }),
        listTurnsBySessionId: async () => [
          {
            ...baseTurn,
            transcriptText: "I want coffee.",
            evaluationStatus: "done",
          },
        ],
        getTranscriptsByTurnIds: async () =>
          new Map([
            [
              TURN_ID,
              {
                ...baseTranscript,
                text: "I want coffee.",
              },
            ],
          ]),
        getCorrectionsByTurnIds: async () =>
          new Map([
            [
              TURN_ID,
              [
                {
                  id: "correction-1",
                  turnId: TURN_ID,
                  type: "expression",
                  originalText: "I want coffee.",
                  correctedText: "Could I get a coffee, please?",
                  explanation: "More polite.",
                  confidence: 0.8,
                },
              ],
            ],
          ]),
        getFreeSpeechEvaluationsByTurnIds: async () => new Map(),
        prepareReportGeneration: async () => ({
          status: "claimed",
          report: {
            id: "report-placeholder",
            sessionId: SESSION_ID,
            summary: REPORT_GENERATING_MARKER,
            taskCompletion: {
              completedGoalIds: [],
              missingGoalIds: [],
            },
            keyCorrections: [],
            alternativeExpressions: [],
            shadowingRecommendations: [],
            nextPracticeSuggestion: "",
            createdAt: "2026-06-07T00:10:00.000Z",
          },
        }),
        finalizeReport: async (_sessionId, input) => ({
          id: "report-1",
          createdAt: "2026-06-07T00:11:00.000Z",
          ...input,
        }),
      },
      { attempts: 1 },
    );

    expect(result.created).toBe(true);
    expect(result.report.summary).toBe("LLM summary for the session.");
    expect(result.report.nextPracticeSuggestion).toBe("LLM next step.");
    expect(result.report.alternativeExpressions).toEqual([
      {
        original: "I want coffee.",
        suggestion: "Could I get a coffee, please?",
      },
    ]);
  });
});
