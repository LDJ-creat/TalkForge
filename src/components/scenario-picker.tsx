"use client";

import { useRouter } from "next/navigation";

import type { Scenario } from "@/domain/scenario";
import { useConversationStore } from "@/features/conversation";
import { formatScenarioRoleLine } from "@/lib/format-scenario-display";
import { homeCopy } from "@/lib/ui-copy";

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
        aria-label={homeCopy.createCard.iconLabel}
        onClick={() => router.push("/scenarios/new")}
      >
        <div className="scenario-card__header">
          <span className="scenario-card__icon" aria-hidden="true">
            +
          </span>
          <div className="scenario-card__content">
            <div className="scenario-card__meta">
              <span className="scenario-card__level">{homeCopy.createCard.badge}</span>
              <span className="scenario-card__role">{homeCopy.createCard.role}</span>
            </div>
            <h2 className="scenario-card__title">{homeCopy.createCard.title}</h2>
            <p className="scenario-card__description">{homeCopy.createCard.description}</p>
            <span className="scenario-card__cta">{homeCopy.createCard.cta} →</span>
          </div>
        </div>
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
            <span className="scenario-card__role">{formatScenarioRoleLine(scenario)}</span>
          </div>
          <h2 className="scenario-card__title">{scenario.title}</h2>
          <p className="scenario-card__description">{scenario.description}</p>
          <span className="scenario-card__cta">{homeCopy.scenarioCta} →</span>
        </button>
      ))}
    </div>
  );
}
