"use client";

import { useState } from "react";

import type { Scenario } from "@/domain/scenario";
import { useConversationStore } from "@/features/conversation";

import { ConversationShell } from "./conversation-shell";
import { ScenarioEntryPanel } from "./scenario-entry-panel";

type ScenarioPracticeShellProps = {
  scenario: Scenario;
};

type PracticePhase = "landing" | "active";

export function ScenarioPracticeShell({ scenario }: ScenarioPracticeShellProps) {
  const [phase, setPhase] = useState<PracticePhase>("landing");
  const selectScenario = useConversationStore((state) => state.selectScenario);

  function handleStartPractice() {
    selectScenario(scenario);
    setPhase("active");
  }

  function handleBackToOverview() {
    setPhase("landing");
  }

  if (phase === "landing") {
    return <ScenarioEntryPanel scenario={scenario} onStartPractice={handleStartPractice} />;
  }

  return (
    <ConversationShell scenario={scenario} onBackToOverview={handleBackToOverview} />
  );
}
