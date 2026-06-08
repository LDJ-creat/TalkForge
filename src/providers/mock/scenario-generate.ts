import { createProviderError } from "../errors";
import type { LlmScenarioGenerateProvider } from "../llm/contract";
import type {
  ScenarioGenerateInput,
  ScenarioGenerationResult,
} from "../llm/scenario-generate-types";

export type MockScenarioGenerateProviderOptions = {
  name?: string;
  failOnGenerate?: boolean;
};

function inferLevel(description: string): ScenarioGenerationResult["scenario"]["level"] {
  if (/\b(c1|advanced|proficient)\b/i.test(description)) {
    return "C1";
  }
  if (/\b(b2|upper[- ]intermediate)\b/i.test(description)) {
    return "B2";
  }
  if (/\b(b1|intermediate)\b/i.test(description)) {
    return "B1";
  }
  if (/\b(a1|beginner|basic)\b/i.test(description)) {
    return "A1";
  }

  return "A2";
}

function buildMockScenario(description: string): ScenarioGenerationResult["scenario"] {
  const level = inferLevel(description);
  const topic = description.trim().slice(0, 120) || "a daily English conversation";

  return {
    title: "自定义练习场景",
    description: `练习用英语进行口语对话：${topic.slice(0, 80)}。`,
    level,
    userRole: "learner",
    aiRole: "conversation partner",
    situation: `The learner wants to practice: ${topic}.`,
    mission: "Help the learner complete a natural spoken role-play in English.",
    goals: [
      {
        id: "open_conversation",
        description: "The learner starts the conversation naturally.",
        required: true,
        completedWhen: "The learner greets or states their need clearly.",
      },
      {
        id: "handle_follow_up",
        description: "The learner responds to at least one follow-up question.",
        required: true,
        completedWhen: "The learner answers a follow-up question from the AI.",
      },
      {
        id: "close_politely",
        description: "The learner closes the conversation politely.",
        required: true,
        completedWhen: "The learner confirms completion or says goodbye.",
      },
    ],
    stages: [
      {
        id: "opening",
        name: "Opening",
        purpose: "Start the role-play.",
        aiBehavior: "Greet the learner and invite them to explain what they need.",
        expectedUserActions: ["greet", "state need"],
      },
      {
        id: "interaction",
        name: "Interaction",
        purpose: "Develop the main exchange.",
        aiBehavior: "Ask one or two short follow-up questions related to the request.",
        expectedUserActions: ["answer question", "ask for clarification"],
      },
      {
        id: "closing",
        name: "Closing",
        purpose: "Finish the practice naturally.",
        aiBehavior: "Summarize the exchange and invite the learner to finish.",
        expectedUserActions: ["confirm", "say goodbye"],
      },
    ],
    vocabulary: ["practice", "help", "please", "thank you"],
    targetExpressions: [
      "Could you help me with this?",
      "I would like to practice...",
      "That works for me, thank you.",
    ],
    constraints: [
      "Stay in character for the full conversation.",
      "Use short, natural sentences suitable for spoken dialogue.",
      "Do not correct grammar unless the learner asks for help.",
    ],
    exitPolicy: {
      minTurns: 4,
      maxTurns: 12,
      maxDurationSec: 360,
      requiredGoals: ["open_conversation", "handle_follow_up", "close_politely"],
      endWhenGoalsCompleted: true,
      allowUserManualEnd: true,
      aiCanSuggestEnd: true,
    },
    evaluationRubric: {
      dimensions: ["task_completion", "fluency", "clarity", "grammar", "expression"],
    },
  };
}

export class MockScenarioGenerateProvider implements LlmScenarioGenerateProvider {
  readonly name: string;
  private readonly failOnGenerate: boolean;

  constructor(options: MockScenarioGenerateProviderOptions = {}) {
    this.name = options.name ?? "mock-scenario-generate";
    this.failOnGenerate = options.failOnGenerate ?? false;
  }

  async generateScenario(input: ScenarioGenerateInput): Promise<ScenarioGenerationResult> {
    if (this.failOnGenerate) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock scenario generate provider is configured to fail generation.",
      });
    }

    return {
      provider: this.name,
      scenario: buildMockScenario(input.description),
      metadata: {
        mock: true,
        descriptionLength: input.description.trim().length,
      },
    };
  }
}

export function createMockScenarioGenerateProvider(
  options?: MockScenarioGenerateProviderOptions,
): MockScenarioGenerateProvider {
  return new MockScenarioGenerateProvider(options);
}
