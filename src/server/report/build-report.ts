import type { Correction } from "@/domain/correction";
import type { PronunciationEvaluation } from "@/domain/pronunciation-evaluation";
import type {
  ReportAlternativeExpression,
  ReportKeyCorrection,
  ReportShadowingRecommendation,
  ReportTaskCompletion,
} from "@/domain/report";
import type { Scenario } from "@/domain/scenario";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import type { ReportTurnContext } from "@/providers/llm/types";

const KEY_CORRECTION_LIMIT = 5;
const SHADOWING_RECOMMENDATION_LIMIT = 5;

export type ReportAggregationInput = {
  sessionId: string;
  scenario: Scenario;
  scenarioProgress: ScenarioProgress | null;
  turns: Turn[];
  transcriptsByTurnId: Map<string, Transcript>;
  correctionsByTurnId: Map<string, Correction[]>;
  evaluationsByTurnId: Map<string, PronunciationEvaluation>;
};

export function resolveScenarioProgress(
  sessionId: string,
  scenario: Scenario,
  progress: ScenarioProgress | null,
): ScenarioProgress {
  if (progress) {
    return progress;
  }

  const requiredGoalIds = scenario.goals.filter((goal) => goal.required).map((goal) => goal.id);

  return {
    sessionId,
    currentStageId: scenario.stages[0]?.id ?? "unknown",
    completedGoalIds: [],
    missingGoalIds: requiredGoalIds,
    shouldSuggestEnding: false,
    offTopic: false,
    updatedAt: new Date().toISOString(),
  };
}

export function computeTaskCompletion(
  scenario: Scenario,
  progress: ScenarioProgress,
  evaluations: PronunciationEvaluation[],
): ReportTaskCompletion {
  const requiredGoalIds = scenario.goals.filter((goal) => goal.required).map((goal) => goal.id);
  const completedRequired = progress.completedGoalIds.filter((goalId) =>
    requiredGoalIds.includes(goalId),
  );

  let score: number | undefined;
  if (requiredGoalIds.length > 0) {
    const goalRatio = completedRequired.length / requiredGoalIds.length;
    score = Math.round(goalRatio * 100);
  } else if (progress.missingGoalIds.length === 0) {
    score = 100;
  }

  const fluencyScores = evaluations
    .map((evaluation) => evaluation.fluencyScore ?? evaluation.overallScore)
    .filter((value): value is number => typeof value === "number");

  if (fluencyScores.length > 0 && typeof score === "number") {
    const averageFluency =
      fluencyScores.reduce((total, value) => total + value, 0) / fluencyScores.length;
    score = Math.round(score * 0.7 + averageFluency * 0.3);
  } else if (fluencyScores.length > 0) {
    score = Math.round(
      fluencyScores.reduce((total, value) => total + value, 0) / fluencyScores.length,
    );
  }

  return {
    completedGoalIds: progress.completedGoalIds,
    missingGoalIds: progress.missingGoalIds,
    score,
  };
}

function normalizePhrase(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function selectKeyCorrections(
  correctionsByTurnId: Map<string, Correction[]>,
  turns: Turn[],
  limit = KEY_CORRECTION_LIMIT,
): ReportKeyCorrection[] {
  const userTurnIds = new Set(
    turns.filter((turn) => turn.role === "user").map((turn) => turn.id),
  );

  return [...correctionsByTurnId.entries()]
    .flatMap(([turnId, corrections]) =>
      corrections
        .filter(
          (correction) =>
            userTurnIds.has(turnId) && correction.type !== "asr_uncertain",
        )
        .map((correction) => ({
          turnId,
          type: correction.type,
          originalText: correction.originalText,
          correctedText: correction.correctedText,
          explanation: correction.explanation,
          confidence: correction.confidence,
        })),
    )
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, limit)
    .map(({ confidence: _confidence, ...correction }) => correction);
}

export function buildAlternativeExpressions(
  correctionsByTurnId: Map<string, Correction[]>,
): ReportAlternativeExpression[] {
  const seen = new Set<string>();

  return [...correctionsByTurnId.values()]
    .flatMap((corrections) => corrections)
    .filter(
      (correction) =>
        correction.type !== "asr_uncertain" &&
        typeof correction.correctedText === "string" &&
        correction.correctedText.trim().length > 0 &&
        (correction.type === "expression" ||
          correction.type === "vocabulary" ||
          correction.type === "grammar"),
    )
    .flatMap((correction) => {
      const suggestion = correction.correctedText!.trim();
      const key = `${normalizePhrase(correction.originalText)}::${normalizePhrase(suggestion)}`;
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);

      return [
        {
          original: correction.originalText,
          suggestion,
          context: correction.explanation,
        },
      ];
    });
}

export function buildShadowingRecommendations(
  scenario: Scenario,
  correctionsByTurnId: Map<string, Correction[]>,
  alternativeExpressions: ReportAlternativeExpression[],
): ReportShadowingRecommendation[] {
  const seen = new Set<string>();
  const recommendations: ReportShadowingRecommendation[] = [];

  const addRecommendation = (text: string, reason?: string) => {
    const normalized = normalizePhrase(text);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    recommendations.push({
      text: text.trim(),
      reason,
    });
  };

  for (const expression of alternativeExpressions) {
    addRecommendation(expression.suggestion, "Stronger alternative from your session.");
  }

  for (const correction of [...correctionsByTurnId.values()].flat()) {
    if (
      correction.correctedText &&
      correction.type !== "asr_uncertain" &&
      correction.correctedText.trim().length > 0
    ) {
      addRecommendation(
        correction.correctedText,
        "Practice this corrected phrase for smoother delivery.",
      );
    }
  }

  for (const targetExpression of scenario.targetExpressions) {
    addRecommendation(targetExpression, `Target expression from ${scenario.title}.`);
  }

  return recommendations.slice(0, SHADOWING_RECOMMENDATION_LIMIT);
}

export function buildDeterministicNextPracticeSuggestion(
  scenario: Scenario,
  taskCompletion: ReportTaskCompletion,
): string {
  if (taskCompletion.missingGoalIds.length > 0) {
    const missingGoals = scenario.goals
      .filter((goal) => taskCompletion.missingGoalIds.includes(goal.id))
      .map((goal) => goal.description);

    if (missingGoals.length > 0) {
      return `Retry ${scenario.title} and focus on: ${missingGoals.join("; ")}.`;
    }
  }

  return `Review ${scenario.level} phrases from ${scenario.title} and practice the recommended shadowing sentences.`;
}

export function buildDeterministicSummary(
  scenario: Scenario,
  turns: Turn[],
  taskCompletion: ReportTaskCompletion,
): string {
  const userTurnCount = turns.filter((turn) => turn.role === "user").length;
  const completedCount = taskCompletion.completedGoalIds.length;
  const missingCount = taskCompletion.missingGoalIds.length;

  if (missingCount === 0) {
    return `You completed ${scenario.title} with ${userTurnCount} learner turns and finished all tracked goals.`;
  }

  return `You practiced ${scenario.title} with ${userTurnCount} learner turns, completing ${completedCount} goal(s) with ${missingCount} still open.`;
}

export function buildReportTurnContexts(
  turns: Turn[],
  transcriptsByTurnId: Map<string, Transcript>,
  correctionsByTurnId: Map<string, Correction[]>,
): ReportTurnContext[] {
  return turns.map((turn) => {
    const transcript = transcriptsByTurnId.get(turn.id);
    const text = transcript?.text ?? turn.transcriptText ?? "";

    return {
      turnId: turn.id,
      role: turn.role,
      text,
      corrections: (correctionsByTurnId.get(turn.id) ?? []).map((correction) => ({
        type: correction.type,
        originalText: correction.originalText,
        correctedText: correction.correctedText,
        explanation: correction.explanation,
        confidence: correction.confidence,
      })),
    };
  });
}

export function buildDeterministicReportSections(input: ReportAggregationInput) {
  const scenarioProgress = resolveScenarioProgress(
    input.sessionId,
    input.scenario,
    input.scenarioProgress,
  );
  const evaluations = [...input.evaluationsByTurnId.values()];
  const taskCompletion = computeTaskCompletion(
    input.scenario,
    scenarioProgress,
    evaluations,
  );
  const keyCorrections = selectKeyCorrections(input.correctionsByTurnId, input.turns);
  const alternativeExpressions = buildAlternativeExpressions(input.correctionsByTurnId);
  const shadowingRecommendations = buildShadowingRecommendations(
    input.scenario,
    input.correctionsByTurnId,
    alternativeExpressions,
  );

  return {
    scenarioProgress,
    taskCompletion,
    keyCorrections,
    alternativeExpressions,
    shadowingRecommendations,
    summary: buildDeterministicSummary(input.scenario, input.turns, taskCompletion),
    nextPracticeSuggestion: buildDeterministicNextPracticeSuggestion(
      input.scenario,
      taskCompletion,
    ),
    turns: buildReportTurnContexts(
      input.turns,
      input.transcriptsByTurnId,
      input.correctionsByTurnId,
    ),
  };
}
