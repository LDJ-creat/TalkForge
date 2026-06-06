import type { Scenario } from "@/domain/scenario";
import {
  buildScenarioProgressUpdate,
  type EndingSuggestionReason,
} from "@/domain/scenario-ending";
import { detectCompletedGoalsFromUserTexts } from "@/domain/scenario-goal-heuristics";

import type { TranscriptEntry } from "./types";

export type LocalScenarioProgressSnapshot = {
  completedGoalIds: string[];
  missingGoalIds: string[];
  shouldSuggestEnding: boolean;
  endingSuggestionReason: EndingSuggestionReason | null;
  offTopic: boolean;
  currentStageId: string;
};

export function evaluateLocalScenarioProgress(input: {
  scenario: Scenario;
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  transcripts: TranscriptEntry[];
  previousCompletedGoalIds?: string[];
}): LocalScenarioProgressSnapshot {
  const userTexts = input.transcripts
    .filter((entry) => entry.role === "user" && entry.status === "final")
    .map((entry) => entry.text);

  const heuristic = detectCompletedGoalsFromUserTexts(
    input.scenario,
    userTexts,
    input.previousCompletedGoalIds ?? [],
  );

  const mockTurns = userTexts.map((text, index) => ({
    id: `local_turn_${index}`,
    sessionId: input.sessionId,
    role: "user" as const,
    startedAt: input.startedAt,
    endedAt: input.startedAt,
    transcriptText: text,
    evaluationStatus: "pending" as const,
  }));

  const progress = buildScenarioProgressUpdate({
    sessionId: input.sessionId,
    scenario: input.scenario,
    session: {
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    },
    turns: mockTurns,
    completedGoalIds: heuristic.completedGoalIds,
    previousCompletedGoalIds: input.previousCompletedGoalIds,
    offTopic: heuristic.offTopic,
  });

  return {
    completedGoalIds: progress.completedGoalIds,
    missingGoalIds: progress.missingGoalIds,
    shouldSuggestEnding: progress.shouldSuggestEnding,
    endingSuggestionReason: progress.endingSuggestionReason,
    offTopic: progress.offTopic,
    currentStageId: progress.currentStageId,
  };
}
