"use client";

import { useRouter } from "next/navigation";

import type { Scenario } from "@/domain/scenario";
import { useConversationStore } from "@/features/conversation";

type ScenarioPickerProps = {
  scenarios: Scenario[];
};

export function ScenarioPicker({ scenarios }: ScenarioPickerProps) {
  const router = useRouter();
  const selectScenario = useConversationStore((state) => state.selectScenario);

  function handleSelect(scenario: Scenario) {
    selectScenario(scenario);
    router.push(`/practice/${scenario.id}`);
  }

  return (
    <div className="scenario-grid" data-testid="scenario-grid">
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          className="scenario-card"
          data-testid={`scenario-card-${scenario.id}`}
          onClick={() => handleSelect(scenario)}
        >
          <div className="scenario-card__meta">
            <span className="scenario-card__level">{scenario.level}</span>
            <span className="scenario-card__role">
              You: {scenario.userRole} · AI: {scenario.aiRole}
            </span>
          </div>
          <h2 className="scenario-card__title">{scenario.title}</h2>
          <p className="scenario-card__description">{scenario.description}</p>
          <span className="scenario-card__cta">Start practice →</span>
        </button>
      ))}
    </div>
  );
}
