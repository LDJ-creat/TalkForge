import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOpenAiCompatibleTextLlmProvider,
} from "@/providers/openai-compatible-text-llm";
import {
  getLlmCorrectionProvider,
  resetLlmCorrectionProviderForTests,
} from "@/server/correction/provider";
import {
  getLlmReportProvider,
  resetLlmReportProviderForTests,
} from "@/server/report/provider";
import {
  getGoalJudgeProvider,
  resetGoalJudgeProviderForTests,
} from "@/server/scenario-progress/provider";
import { createTracedLlmCorrectionProvider } from "@/server/llm/tracing-wrapper";
import { createTracedLlmGoalJudgeProvider } from "@/server/llm/tracing-wrapper";
import {
  collectRuntimeConfigIssues,
  parseRuntimeConfigFromEnv,
  resetRuntimeConfigForTests,
} from "@/server/config";

describe("text LLM provider configuration", () => {
  afterEach(() => {
    resetLlmCorrectionProviderForTests();
    resetLlmReportProviderForTests();
    resetGoalJudgeProviderForTests();
    resetRuntimeConfigForTests();
  });

  it("defaults to the mock provider", () => {
    process.env.LLM_CORRECTION_PROVIDER = "mock";

    expect(getLlmCorrectionProvider().name).toBe("mock-llm");
  });

  it("creates an OpenAI-compatible provider when configured", () => {
    process.env.LLM_CORRECTION_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";

    expect(getLlmCorrectionProvider().name).toBe("openai-openai-compatible-text-llm");
  });

  it("keeps separate provider instances for correction and report selections", () => {
    process.env.LLM_CORRECTION_PROVIDER = "openai";
    process.env.LLM_REPORT_PROVIDER = "dashscope";
    process.env.LLM_API_KEY = "test-key";

    const correctionProvider = getLlmCorrectionProvider();
    const reportProvider = getLlmReportProvider();

    expect(correctionProvider.name).toBe("openai-openai-compatible-text-llm");
    expect(reportProvider.name).toBe("dashscope-openai-compatible-text-llm");
    expect(correctionProvider).not.toBe(reportProvider);
  });

  it("rejects unknown custom provider ids without LLM_BASE_URL", () => {
    process.env.LLM_CORRECTION_PROVIDER = "custom-vendor";
    process.env.LLM_API_KEY = "test-key";
    delete process.env.LLM_BASE_URL;

    expect(() => getLlmCorrectionProvider()).toThrowError(
      /LLM_BASE_URL is required/i,
    );
  });

  it("allows custom provider ids when LLM_BASE_URL is configured", () => {
    process.env.LLM_CORRECTION_PROVIDER = "custom-vendor";
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://llm.example.com/v1";

    expect(getLlmCorrectionProvider().name).toBe("custom-vendor-openai-compatible-text-llm");
  });

  it("defaults to the mock goal judge provider", () => {
    process.env.LLM_GOAL_JUDGE_PROVIDER = "mock";

    expect(getGoalJudgeProvider().name).toBe("mock-goal-judge");
  });

  it("creates an OpenAI-compatible goal judge provider when configured", () => {
    process.env.LLM_GOAL_JUDGE_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";

    expect(getGoalJudgeProvider().name).toBe("openai-openai-compatible-text-llm");
  });

  it("reuses the same OpenAI-compatible provider instance across text LLM roles", () => {
    process.env.LLM_CORRECTION_PROVIDER = "openai";
    process.env.LLM_GOAL_JUDGE_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";

    const correctionProvider = getLlmCorrectionProvider();
    const goalJudgeProvider = getGoalJudgeProvider();

    expect(correctionProvider).toBe(goalJudgeProvider);
  });

  it("requires LLM_BASE_URL for custom real providers during config validation", () => {
    const config = parseRuntimeConfigFromEnv({
      NODE_ENV: "test",
      LLM_CORRECTION_PROVIDER: "custom-vendor",
      LLM_REPORT_PROVIDER: "mock",
      LLM_API_KEY: "test-key",
    });

    const issues = collectRuntimeConfigIssues(config, {
      NODE_ENV: "test",
      LLM_CORRECTION_PROVIDER: "custom-vendor",
      LLM_REPORT_PROVIDER: "mock",
      LLM_API_KEY: "test-key",
    });

    expect(issues.some((issue) => issue.includes("LLM_BASE_URL"))).toBe(true);
  });
});

describe("traced text LLM providers", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    resetLlmCorrectionProviderForTests();
    resetGoalJudgeProviderForTests();
    resetRuntimeConfigForTests();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("records report rawRequest prompts when tracing is enabled", async () => {
    process.env.LLM_REPORT_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";

    const record = vi.fn(async (input: { rawRequest?: unknown }) => ({
      id: "trace-1",
      provider: "openai-openai-compatible-text-llm",
      model: "gpt-4o-mini",
      operation: "llm.report",
      status: "success" as const,
      latencyMs: 1,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      rawRequest: input.rawRequest,
    }));

    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Done",
                nextPracticeSuggestion: "Retry",
              }),
            },
          },
        ],
      }),
    ) as typeof fetch;

    const provider = getLlmReportProvider({
      traceWriter: { record },
    });

    await provider.generateReport({
      sessionId: "session-1",
      scenario: {
        id: "cafe-order",
        title: "Cafe Order",
        level: "A2",
        goals: [],
        evaluationRubric: { dimensions: ["fluency"] },
      },
      scenarioProgress: {
        sessionId: "session-1",
        currentStageId: "stage-1",
        completedGoalIds: [],
        missingGoalIds: [],
        shouldSuggestEnding: false,
        offTopic: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
      turns: [],
    });

    expect(record).toHaveBeenCalledOnce();
    expect(record.mock.calls[0]?.[0]?.rawRequest).toMatchObject({
      system: expect.stringContaining("Return JSON only"),
      user: expect.stringContaining("Cafe Order"),
    });
  });

  it("records goal judge rawRequest prompts when tracing is enabled", async () => {
    process.env.LLM_GOAL_JUDGE_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";

    const record = vi.fn(async (input: { rawRequest?: unknown }) => ({
      id: "trace-goal-judge",
      provider: "openai-openai-compatible-text-llm",
      model: "gpt-4o-mini",
      operation: "llm.scenarioJudge",
      status: "success" as const,
      latencyMs: 1,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      rawRequest: input.rawRequest,
    }));

    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: JSON.stringify({
                completedGoalIds: ["choose_drink"],
                offTopic: false,
                shouldSuggestEnding: false,
              }),
            },
          },
        ],
      }),
    ) as typeof fetch;

    const provider = getGoalJudgeProvider({
      traceWriter: { record },
    });

    await provider.evaluateGoals({
      sessionId: "session-1",
      scenario: {
        id: "coffee_ordering_a2",
        title: "Order Coffee at a Cafe",
        goals: [
          {
            id: "choose_drink",
            description: "Choose a drink",
            required: true,
            completedWhen: "states a drink",
          },
        ],
        stages: [{ id: "greeting", name: "Greeting", purpose: "Start", aiBehavior: "Greet", expectedUserActions: [] }],
        vocabulary: ["latte"],
        targetExpressions: [],
        exitPolicy: {
          minTurns: 1,
          maxTurns: 12,
          maxDurationSec: 600,
          requiredGoals: ["choose_drink"],
          endWhenGoalsCompleted: true,
          allowUserManualEnd: true,
          aiCanSuggestEnd: true,
        },
      },
      turns: [{ turnId: "turn-1", role: "user", text: "Could I get a latte?" }],
      previousProgress: null,
    });

    expect(record).toHaveBeenCalledOnce();
    expect(record.mock.calls[0]?.[0]?.rawRequest).toMatchObject({
      system: expect.stringContaining("Return JSON only"),
      user: expect.stringContaining("choose_drink"),
    });
  });

  it("tracing wrapper calls invokeGoalEvaluation instead of evaluateGoals", async () => {
    const baseProvider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const invokeSpy = vi.spyOn(baseProvider, "invokeGoalEvaluation").mockResolvedValue({
      provider: baseProvider.name,
      completedGoalIds: ["choose_drink"],
      offTopic: false,
      metadata: { parseFallback: false },
    });
    const evaluateSpy = vi.spyOn(baseProvider, "evaluateGoals");

    const tracedProvider = createTracedLlmGoalJudgeProvider(
      baseProvider,
      { record: vi.fn(async () => null) },
      { model: "gpt-4o-mini" },
    );

    await tracedProvider.evaluateGoals({
      sessionId: "session-1",
      scenario: {
        id: "coffee_ordering_a2",
        title: "Order Coffee at a Cafe",
        goals: [],
        stages: [],
        vocabulary: [],
        targetExpressions: [],
        exitPolicy: {
          minTurns: 1,
          maxTurns: 12,
          maxDurationSec: 600,
          requiredGoals: [],
          endWhenGoalsCompleted: true,
          allowUserManualEnd: true,
          aiCanSuggestEnd: true,
        },
      },
      turns: [],
      previousProgress: null,
    });

    expect(invokeSpy).toHaveBeenCalledOnce();
    expect(evaluateSpy).not.toHaveBeenCalled();
  });

  it("tracing wrapper calls invokeCorrectionAnalysis instead of analyzeCorrections", async () => {
    const baseProvider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const invokeSpy = vi
      .spyOn(baseProvider, "invokeCorrectionAnalysis")
      .mockResolvedValue({
        provider: baseProvider.name,
        corrections: [],
        metadata: { parseFallback: false },
      });
    const analyzeSpy = vi.spyOn(baseProvider, "analyzeCorrections");

    const tracedProvider = createTracedLlmCorrectionProvider(
      baseProvider,
      { record: vi.fn(async () => null) },
      { model: "gpt-4o-mini" },
    );

    await tracedProvider.analyzeCorrections({
      turnId: "turn-1",
      transcriptText: "Hello",
      recentContext: [],
      scenarioLevel: "A2",
      prompt: { system: "system", user: "user" },
    });

    expect(invokeSpy).toHaveBeenCalledOnce();
    expect(analyzeSpy).not.toHaveBeenCalled();
  });
});
