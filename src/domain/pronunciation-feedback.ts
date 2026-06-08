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

export function isPronunciationSilWord(word: string): boolean {
  return word.trim().toLowerCase() === "sil";
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

export function filterPronunciationDisplayWords(
  words: PronunciationWordFeedback[],
): PronunciationWordFeedback[] {
  return words.filter((word) => !isPronunciationSilWord(word.word));
}

export function deriveScoresFromWordFeedback(
  words?: PronunciationWordFeedback[],
): Pick<TurnPronunciationFeedback, "overallScore" | "accuracyScore"> {
  if (!words?.length) {
    return {};
  }

  const scored = words.filter(
    (word) =>
      !isPronunciationSilWord(word.word) &&
      typeof word.score === "number" &&
      Number.isFinite(word.score),
  );

  if (scored.length === 0) {
    return {};
  }

  const average =
    scored.reduce((sum, word) => sum + word.score!, 0) / scored.length;

  return {
    overallScore: average,
    accuracyScore: average,
  };
}

export function enrichTurnPronunciationFeedback(
  feedback: TurnPronunciationFeedback,
): TurnPronunciationFeedback {
  const derived = deriveScoresFromWordFeedback(feedback.words);

  return {
    ...feedback,
    overallScore: feedback.overallScore ?? derived.overallScore,
    accuracyScore: feedback.accuracyScore ?? derived.accuracyScore,
    fluencyScore: feedback.fluencyScore,
    completenessScore: feedback.completenessScore,
  };
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

  feedback.overallScore = input.evaluation.overallScore ?? undefined;
  feedback.accuracyScore = input.evaluation.accuracyScore ?? undefined;
  feedback.fluencyScore = input.evaluation.fluencyScore ?? undefined;
  feedback.completenessScore = input.evaluation.completenessScore ?? undefined;
  feedback.words = buildPronunciationWordFeedback(input.evaluation.details);

  return enrichTurnPronunciationFeedback(feedback);
}
