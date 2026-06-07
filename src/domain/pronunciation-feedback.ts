import type { EvaluationStatus } from "./enums";
import type { PronunciationEvaluation } from "./pronunciation-evaluation";

export const PRONUNCIATION_WEAK_WORD_SCORE_THRESHOLD = 60;

export type PronunciationWordFeedbackStatus = "ok" | "weak";

export type PronunciationWordFeedback = {
  word: string;
  score?: number;
  status: PronunciationWordFeedbackStatus;
};

export type TurnPronunciationFeedback = {
  evaluationStatus: EvaluationStatus;
  overallScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  words?: PronunciationWordFeedback[];
  referenceSource?: "transcript" | "turn_fallback";
};

type IflytekWordDetail = {
  word?: string;
  score?: number;
};

type IflytekNormalizedDetails = {
  referenceText?: string;
  words?: IflytekWordDetail[];
};

function extractWordDetails(details: unknown): IflytekWordDetail[] {
  if (!details || typeof details !== "object" || !("words" in details)) {
    return [];
  }

  const words = (details as IflytekNormalizedDetails).words;
  return Array.isArray(words) ? words : [];
}

export function mapWordScoreToFeedbackStatus(
  score: number | undefined,
  threshold = PRONUNCIATION_WEAK_WORD_SCORE_THRESHOLD,
): PronunciationWordFeedbackStatus {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "ok";
  }

  return score < threshold ? "weak" : "ok";
}

export function buildPronunciationWordFeedback(
  details: unknown,
  threshold = PRONUNCIATION_WEAK_WORD_SCORE_THRESHOLD,
): PronunciationWordFeedback[] {
  return extractWordDetails(details)
    .filter((entry) => typeof entry.word === "string" && entry.word.trim().length > 0)
    .map((entry) => ({
      word: entry.word!.trim(),
      score: entry.score,
      status: mapWordScoreToFeedbackStatus(entry.score, threshold),
    }));
}

export function buildTurnPronunciationFeedback(input: {
  evaluationStatus: EvaluationStatus;
  evaluation?: PronunciationEvaluation | null;
}): TurnPronunciationFeedback | undefined {
  if (input.evaluationStatus === "none") {
    return undefined;
  }

  const feedback: TurnPronunciationFeedback = {
    evaluationStatus: input.evaluationStatus,
  };

  if (!input.evaluation) {
    return feedback;
  }

  feedback.overallScore = input.evaluation.overallScore;
  feedback.accuracyScore = input.evaluation.accuracyScore;
  feedback.fluencyScore = input.evaluation.fluencyScore;
  feedback.completenessScore = input.evaluation.completenessScore;
  feedback.words = buildPronunciationWordFeedback(input.evaluation.details);

  return feedback;
}
