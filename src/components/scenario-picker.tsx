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
      <button
        type="button"
        className="scenario-card scenario-card--create"
        data-testid="scenario-card-create"
        onClick={() => router.push("/scenarios/new")}
      >
        <div className="scenario-card__meta">
          <span className="scenario-card__level">New</span>
          <span className="scenario-card__role">Custom scenario</span>
        </div>
        <h2 className="scenario-card__title">Create your own scenario</h2>
        <p className="scenario-card__description">
          Describe what you want to practice and let TalkForge generate a role-play for you.
        </p>
        <span className="scenario-card__cta">Create scenario →</span>
      </button>
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
          <span className="scenario-card__cta">View history & practice →</span>
        </button>
      ))}
    </div>
  );
}
