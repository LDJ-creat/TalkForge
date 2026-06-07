"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ScenarioDraft } from "@/providers/llm/scenario-generate-types";
import {
  createScenarioOnServer,
  generateScenarioFromDescription,
} from "@/features/scenario-create/api";
import { formatScenarioRoleLine } from "@/lib/format-scenario-display";
import { navCopy, scenarioCreateCopy } from "@/lib/ui-copy";

type ScenarioCreateFormProps = {
  backHref?: string;
};

export function ScenarioCreateForm({ backHref = "/" }: ScenarioCreateFormProps) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<ScenarioDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function handleGenerate() {
    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const result = await generateScenarioFromDescription(description);
      setDraft(result.scenario);
      setShowDetails(false);
    } catch (error) {
      setDraft(null);
      setErrorMessage(
        error instanceof Error ? error.message : scenarioCreateCopy.generateFailed,
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleConfirm() {
    if (!draft) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await createScenarioOnServer(draft);
      router.push(backHref);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : scenarioCreateCopy.saveFailed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="scenario-create">
      <Link href={backHref} className="scenario-entry__back">
        {navCopy.backToScenarios}
      </Link>

      <header className="scenario-create__header">
        <h1 className="scenario-entry__title">{scenarioCreateCopy.title}</h1>
        <p className="scenario-entry__subtitle">{scenarioCreateCopy.subtitle}</p>
      </header>

      <section className="scenario-create__panel">
        <label className="scenario-create__label" htmlFor="scenario-description">
          {scenarioCreateCopy.requestLabel}
        </label>
        <textarea
          id="scenario-description"
          className="scenario-create__textarea"
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={scenarioCreateCopy.placeholder}
          disabled={isGenerating || isSaving}
        />
        <div className="scenario-create__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || isSaving || description.trim().length === 0}
          >
            {isGenerating
              ? scenarioCreateCopy.generating
              : draft
                ? scenarioCreateCopy.regenerate
                : scenarioCreateCopy.generate}
          </button>
        </div>
      </section>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      {draft ? (
        <section className="scenario-create__preview" data-testid="scenario-create-preview">
          <article className="scenario-card scenario-card--preview">
            <div className="scenario-card__meta">
              <span className="scenario-card__level">{draft.level}</span>
              <span className="scenario-card__role">{formatScenarioRoleLine(draft)}</span>
            </div>
            <h2 className="scenario-card__title">{draft.title}</h2>
            <p className="scenario-card__description">{draft.description}</p>
            <p className="scenario-create__mission">{draft.mission}</p>
          </article>

          <button
            type="button"
            className="scenario-create__details-toggle"
            onClick={() => setShowDetails((current) => !current)}
          >
            {showDetails ? scenarioCreateCopy.hideDetails : scenarioCreateCopy.showDetails}
          </button>

          {showDetails ? (
            <div className="scenario-create__details">
              <div className="scenario-create__details-section">
                <h3>{scenarioCreateCopy.goals}</h3>
                <ul>
                  {draft.goals.map((goal) => (
                    <li key={goal.id}>
                      {goal.description}
                      {goal.required ? scenarioCreateCopy.required : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="scenario-create__details-section">
                <h3>{scenarioCreateCopy.stages}</h3>
                <ul>
                  {draft.stages.map((stage) => (
                    <li key={stage.id}>
                      {stage.name}: {stage.purpose}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="scenario-create__details-section">
                <h3>{scenarioCreateCopy.targetExpressions}</h3>
                <ul>
                  {draft.targetExpressions.map((expression) => (
                    <li key={expression}>{expression}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="scenario-create__confirm-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleConfirm()}
              disabled={isSaving || isGenerating}
              data-testid="scenario-create-confirm"
            >
              {isSaving ? scenarioCreateCopy.saving : scenarioCreateCopy.confirm}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
