import { afterEach, describe, expect, it, vi } from "vitest";

import { isProviderError } from "@/providers/errors";
import { createOpenAiCompatibleTextLlmProvider } from "@/providers/openai-compatible-text-llm";
import {
  buildCorrectionAnalyzeInput,
  buildCorrectionPromptFromAnalyzeInput,
} from "@/server/correction/prompt-builder";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";

const originalFetch = global.fetch;

describe("OpenAiCompatibleTextLlmProvider", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses structured correction output from chat completions", async () => {
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
                    confidence: 0.91,
                  },
                ],
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 40 },
      }),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const analyzeInput = buildCorrectionAnalyzeInput({
      turnId: "turn-1",
      transcript: {
        id: "transcript-1",
        turnId: "turn-1",
        provider: "mock-asr",
        text: "Yesterday I go to the cafe.",
        confidence: 0.92,
        segments: [{ startMs: 0, endMs: 1000, text: "Yesterday I go to the cafe." }],
      },
      recentContext: [],
      scenarioLevel: "A2",
    });
    const prompt = buildCorrectionPromptFromAnalyzeInput(analyzeInput);

    const result = await provider.analyzeCorrections({
      ...analyzeInput,
      prompt: {
        system: prompt.system,
        user: prompt.user,
      },
    });

    expect(result.provider).toBe("openai-openai-compatible-text-llm");
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]?.correctedText).toBe("I went to");
    expect(result.metadata).toMatchObject({
      parseFallback: false,
      inputTokens: 120,
      outputTokens: 40,
    });
  });

  it("falls back to empty corrections when provider JSON is malformed", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: "not-json",
            },
          },
        ],
      }),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const result = await provider.analyzeCorrections({
      turnId: "turn-1",
      transcriptText: "Hello there.",
      recentContext: [],
      scenarioLevel: "A2",
      prompt: {
        system: "system",
        user: "user",
      },
    });

    expect(result.corrections).toEqual([]);
    expect(result.metadata).toMatchObject({
      parseFallback: true,
    });
  });

  it("returns structured report output and falls back safely on malformed JSON", async () => {
    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "You handled the cafe order well.",
                nextPracticeSuggestion: "Practice polite requests.",
                alternativeExpressions: [
                  {
                    original: "I want coffee.",
                    suggestion: "Could I get a coffee, please?",
                    context: "Ordering",
                  },
                ],
                shadowingRecommendations: [
                  {
                    text: "Could I get a coffee, please?",
                    reason: "Natural ordering phrase.",
                  },
                ],
              }),
            },
          },
        ],
      }),
    ) as typeof fetch;

    const goodResult = await provider.generateReport({
      sessionId: "session-1",
      scenario: {
        id: "cafe-order",
        title: "Cafe Order",
        level: "A2",
        goals: [{ id: "order-drink", description: "Order a drink", required: true }],
        evaluationRubric: { dimensions: ["fluency"] },
      },
      scenarioProgress: {
        sessionId: "session-1",
        currentStageId: "stage-1",
        completedGoalIds: ["order-drink"],
        missingGoalIds: [],
        shouldSuggestEnding: true,
        offTopic: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
      turns: [
        {
          turnId: "turn-1",
          role: "user",
          text: "I want coffee.",
        },
      ],
    });

    expect(goodResult.summary).toContain("cafe order");
    expect(goodResult.alternativeExpressions).toHaveLength(1);

    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [{ message: { content: "{broken" } }],
      }),
    ) as typeof fetch;

    const fallbackResult = await provider.generateReport({
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
        missingGoalIds: ["order-drink"],
        shouldSuggestEnding: false,
        offTopic: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
      turns: [],
    });

    expect(fallbackResult.summary).toBe("");
    expect(fallbackResult.alternativeExpressions).toEqual([]);
    expect(fallbackResult.metadata).toMatchObject({ parseFallback: true });
  });

  it("parses structured goal judge output from chat completions", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              content: JSON.stringify({
                completedGoalIds: ["choose_drink", "choose_size"],
                missingGoalIds: ["confirm_payment"],
                currentStageId: "customization",
                offTopic: false,
                shouldSuggestEnding: false,
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 90, completion_tokens: 30 },
      }),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const result = await provider.evaluateGoals({
      sessionId: "session-1",
      scenario: {
        id: coffeeOrderingScenario.id,
        title: coffeeOrderingScenario.title,
        goals: coffeeOrderingScenario.goals,
        stages: coffeeOrderingScenario.stages,
        vocabulary: coffeeOrderingScenario.vocabulary,
        targetExpressions: coffeeOrderingScenario.targetExpressions,
        exitPolicy: coffeeOrderingScenario.exitPolicy,
      },
      turns: [
        {
          turnId: "turn-1",
          role: "user",
          text: "Could I get a medium latte?",
        },
      ],
      previousProgress: null,
    });

    expect(result.provider).toBe("openai-openai-compatible-text-llm");
    expect(result.completedGoalIds).toEqual(
      expect.arrayContaining(["choose_drink", "choose_size"]),
    );
    expect(result.offTopic).toBe(false);
    expect(result.metadata).toMatchObject({
      parseFallback: false,
      promptVersion: "goal-judge-v1",
      inputTokens: 90,
      outputTokens: 30,
    });
  });

  it("falls back to heuristic goal progress when provider JSON is malformed", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        model: "gpt-4o-mini",
        choices: [{ message: { content: "{broken" } }],
      }),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "test-key",
    });

    const result = await provider.evaluateGoals({
      sessionId: "session-1",
      scenario: {
        id: coffeeOrderingScenario.id,
        title: coffeeOrderingScenario.title,
        goals: coffeeOrderingScenario.goals,
        stages: coffeeOrderingScenario.stages,
        vocabulary: coffeeOrderingScenario.vocabulary,
        targetExpressions: coffeeOrderingScenario.targetExpressions,
        exitPolicy: coffeeOrderingScenario.exitPolicy,
      },
      turns: [
        {
          turnId: "turn-1",
          role: "user",
          text: "Could I get a medium latte with oat milk? Yes, that's correct.",
        },
      ],
      previousProgress: null,
    });

    expect(result.completedGoalIds.length).toBeGreaterThan(0);
    expect(result.metadata).toMatchObject({ parseFallback: true });
  });

  it("maps HTTP failures to provider errors", async () => {
    global.fetch = vi.fn(async () =>
      Response.json(
        { error: { message: "Invalid API key." } },
        { status: 401 },
      ),
    ) as typeof fetch;

    const provider = createOpenAiCompatibleTextLlmProvider({
      providerName: "openai",
      apiKey: "bad-key",
    });

    await expect(
      provider.analyzeCorrections({
        turnId: "turn-1",
        transcriptText: "Hello.",
        recentContext: [],
        scenarioLevel: "A2",
        prompt: { system: "system", user: "user" },
      }),
    ).rejects.toSatisfy((error) => isProviderError(error) && error.code === "authentication");
  });
});
