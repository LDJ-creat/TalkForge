import { describe, expect, it } from "vitest";

import {
  generateScenarioSystemInstructions,
  validateScenario,
} from "@/domain";
import type { Scenario } from "@/domain/scenario";
import { coffeeOrderingScenario, seedScenarios } from "@/server/db/seeds/scenarios";
import {
  getSeedScenarioById,
  getSeedScenarioOrThrow,
  listSeedScenarios,
} from "@/server/scenario/catalog";

describe("scenario validation", () => {
  it("validates all seed scenarios", () => {
    expect(seedScenarios).toHaveLength(5);

    for (const scenario of seedScenarios) {
      const result = validateScenario(scenario);
      expect(result.valid, JSON.stringify(result)).toBe(true);
    }
  });

  it("rejects invalid exit policy when maxTurns is below minTurns", () => {
    const invalidScenario: Scenario = {
      ...coffeeOrderingScenario,
      exitPolicy: {
        ...coffeeOrderingScenario.exitPolicy,
        minTurns: 8,
        maxTurns: 4,
      },
    };

    const result = validateScenario(invalidScenario);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "exitPolicy.maxTurns",
          }),
        ]),
      );
    }
  });

  it("rejects unknown required goal ids", () => {
    const invalidScenario: Scenario = {
      ...coffeeOrderingScenario,
      exitPolicy: {
        ...coffeeOrderingScenario.exitPolicy,
        requiredGoals: ["missing_goal"],
      },
    };

    const result = validateScenario(invalidScenario);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "exitPolicy.requiredGoals",
            message: expect.stringContaining("missing_goal"),
          }),
        ]),
      );
    }
  });

  it("rejects scenarios when required goals are missing from exitPolicy", () => {
    const invalidScenario: Scenario = {
      ...coffeeOrderingScenario,
      exitPolicy: {
        ...coffeeOrderingScenario.exitPolicy,
        requiredGoals: ["choose_drink"],
      },
    };

    const result = validateScenario(invalidScenario);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "exitPolicy.requiredGoals",
            message: expect.stringContaining("choose_size"),
          }),
        ]),
      );
    }
  });
});

describe("scenario prompt generation", () => {
  it("generates deterministic system instructions for coffee ordering", () => {
    const prompt = generateScenarioSystemInstructions(coffeeOrderingScenario);

    expect(prompt).toMatchSnapshot();
    expect(prompt).toContain("You are role-playing as a barista.");
    expect(prompt).toContain("Conversation goals:");
    expect(prompt).toContain("Behavior rules:");
    expect(prompt).not.toContain('"id":');
    expect(prompt).not.toContain("exitPolicy");
  });

  it("includes shared behavior rules for every seed scenario", () => {
    for (const scenario of seedScenarios) {
      const prompt = generateScenarioSystemInstructions(scenario);

      expect(prompt).toContain(
        "Do not interrupt the learner with grammar corrections unless they explicitly ask for help.",
      );
      expect(prompt).toContain(
        "After all conversation goals are complete, naturally ask whether they want to finish the practice.",
      );
    }
  });
});

describe("scenario catalog", () => {
  it("loads seed scenarios by id", () => {
    const scenarios = listSeedScenarios();

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "coffee_ordering_a2",
      "english_interview_b1",
      "self_introduction_a2",
      "meeting_update_b1",
      "travel_directions_a2",
    ]);

    expect(getSeedScenarioById("travel_directions_a2")?.title).toBe("问路");
    expect(getSeedScenarioOrThrow("english_interview_b1").level).toBe("B1");
    expect(getSeedScenarioById("unknown_scenario")).toBeNull();
  });

  it("throws when a scenario id is missing", () => {
    expect(() => getSeedScenarioOrThrow("unknown_scenario")).toThrow(
      "Scenario not found: unknown_scenario",
    );
  });
});
