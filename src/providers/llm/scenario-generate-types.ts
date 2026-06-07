import type { Scenario } from "@/domain/scenario";

export type ScenarioGenerateInput = {
  description: string;
  referenceScenarios?: Pick<Scenario, "title" | "level" | "userRole" | "aiRole">[];
};

export type ScenarioDraft = Omit<Scenario, "id">;

export type ScenarioGenerationResult = {
  provider: string;
  scenario: ScenarioDraft;
  metadata?: Record<string, unknown>;
};
