import { describe, expect, it } from "vitest";

import type { Scenario } from "@/domain/scenario";
import { fromScenario, toScenario } from "@/server/db/mappers";
import { coffeeOrderingScenario, seedScenarios } from "@/server/db/seeds/scenarios";
import {
  audioSegments,
  corrections,
  pronunciationEvaluations,
  reports,
  scenarioProgress,
  scenarios,
  sessions,
  transcripts,
  turns,
  users,
} from "@/server/db/schema";

describe("domain schema contracts", () => {
  it("exports all P0 entity tables", () => {
    expect(users).toBeDefined();
    expect(scenarios).toBeDefined();
    expect(sessions).toBeDefined();
    expect(scenarioProgress).toBeDefined();
    expect(turns).toBeDefined();
    expect(audioSegments).toBeDefined();
    expect(transcripts).toBeDefined();
    expect(corrections).toBeDefined();
    expect(pronunciationEvaluations).toBeDefined();
    expect(reports).toBeDefined();
  });

  it("keeps seed scenarios compatible with the Scenario contract", () => {
    const assertScenario = (scenario: Scenario) => {
      expect(scenario.id.length).toBeGreaterThan(0);
      expect(scenario.goals.length).toBeGreaterThan(0);
      expect(scenario.stages.length).toBeGreaterThan(0);
      expect(scenario.exitPolicy.requiredGoals.length).toBeGreaterThan(0);
      expect(scenario.evaluationRubric.dimensions.length).toBeGreaterThan(0);
    };

    for (const scenario of seedScenarios) {
      assertScenario(scenario);
    }

    expect(coffeeOrderingScenario.exitPolicy.maxTurns).toBe(12);
  });

  it("maps scenarios between domain and database rows", () => {
    const insertRow = fromScenario(coffeeOrderingScenario);
    const mapped = toScenario({
      ...insertRow,
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(mapped).toEqual(coffeeOrderingScenario);
  });
});
