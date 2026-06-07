import { afterEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import {
  createGenerateScenarioDeps,
  generateScenarioFromDescription,
} from "@/server/scenario/generate-scenario";
import {
  createCreateCustomScenarioDeps,
  createCustomScenario,
} from "@/server/scenario/create-custom-scenario";
import { resetScenarioGenerateProviderForTests } from "@/server/scenario-generation/provider";
import { resetRuntimeConfigForTests } from "@/server/config";

describe("scenario generation service", () => {
  afterEach(() => {
    resetScenarioGenerateProviderForTests();
    resetRuntimeConfigForTests();
    vi.restoreAllMocks();
  });

  it("generates a valid scenario draft with the mock provider", async () => {
    process.env.LLM_SCENARIO_GENERATE_PROVIDER = "mock";

    const result = await generateScenarioFromDescription(
      { description: "Practice buying medicine at a pharmacy, A2 level." },
      createGenerateScenarioDeps(),
    );

    expect(result.provider).toBe("mock-scenario-generate");
    expect(result.scenario.title).toBeTruthy();
    expect(result.scenario.goals.length).toBeGreaterThan(0);
    expect(result.promptVersion).toBe("scenario-generate-v1");
  });

  it("persists a custom scenario with an assigned id", async () => {
    const existingIds = new Set<string>();
    const stored = vi.fn(async (scenario: typeof coffeeOrderingScenario) => scenario);

    const scenario = await createCustomScenario(
      {
        scenario: {
          ...coffeeOrderingScenario,
          id: undefined,
          title: "Pharmacy Visit",
        },
      },
      {
        collectExistingScenarioIds: async () => existingIds,
        upsertScenario: stored,
      },
    );

    expect(scenario.id).toBe("custom_pharmacy_visit");
    expect(stored).toHaveBeenCalledOnce();
  });
});

describe("create custom scenario deps", () => {
  it("creates deps from a database handle", () => {
    const deps = createCreateCustomScenarioDeps({} as never);
    expect(deps.collectExistingScenarioIds).toBeTypeOf("function");
    expect(deps.upsertScenario).toBeTypeOf("function");
  });
});
