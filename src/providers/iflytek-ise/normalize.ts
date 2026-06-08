import type { PronunciationMode } from "@/domain/enums";
import { createProviderError } from "@/providers/errors";
import type { PronunciationEvaluationResult } from "@/providers/pronunciation/types";

import { IFLYTEK_ISE_PROVIDER_NAME } from "./config";
import type { IflytekIseEvaluationResponse } from "./types";

export type IflytekIseReadSentenceScores = {
  totalScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  standardScore?: number;
};

export type IflytekIseWordDetail = {
  word: string;
  score?: number;
  dpMessage?: number;
};

export type IflytekIseNormalizedDetails = {
  referenceText: string;
  recordId?: string;
  words: IflytekIseWordDetail[];
  rawXml?: string;
};

function parseNumericAttribute(
  source: string,
  attributeName: string,
): number | undefined {
  const pattern = new RegExp(`${attributeName}="([^"]+)"`);
  const match = source.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const IFLYTEK_ISE_SCORE_CONTAINER_TAGS = [
  "read_sentence",
  "read_chapter",
  "read_word",
  "rec_paper",
] as const;

function parseIflytekIseScoresFromTag(tag: string): IflytekIseReadSentenceScores {
  return {
    totalScore: parseNumericAttribute(tag, "total_score"),
    accuracyScore: parseNumericAttribute(tag, "accuracy_score"),
    fluencyScore: parseNumericAttribute(tag, "fluency_score"),
    completenessScore: parseNumericAttribute(tag, "integrity_score"),
    standardScore: parseNumericAttribute(tag, "standard_score"),
  };
}

export function parseIflytekIseReadSentenceScores(xml: string): IflytekIseReadSentenceScores {
  for (const tagName of IFLYTEK_ISE_SCORE_CONTAINER_TAGS) {
    const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>`));
    if (!match) {
      continue;
    }

    const scores = parseIflytekIseScoresFromTag(match[0]);
    if (
      scores.totalScore !== undefined ||
      scores.accuracyScore !== undefined ||
      scores.fluencyScore !== undefined
    ) {
      return scores;
    }
  }

  return {};
}

function averageWordScores(words: IflytekIseWordDetail[]): number | undefined {
  const scored = words.filter(
    (word) =>
      word.word.trim().toLowerCase() !== "sil" &&
      typeof word.score === "number" &&
      Number.isFinite(word.score),
  );

  if (scored.length === 0) {
    return undefined;
  }

  return scored.reduce((sum, word) => sum + word.score!, 0) / scored.length;
}

export function parseIflytekIseWordDetails(xml: string): IflytekIseWordDetail[] {
  const words: IflytekIseWordDetail[] = [];
  const wordPattern = /<word\b([^>]*)\/>|<word\b([^>]*)>/g;

  for (const match of xml.matchAll(wordPattern)) {
    const attributes = match[1] ?? match[2] ?? "";
    const contentMatch = attributes.match(/\bcontent="([^"]+)"/);
    if (!contentMatch?.[1]) {
      continue;
    }

    words.push({
      word: contentMatch[1],
      score: parseNumericAttribute(attributes, "total_score"),
      dpMessage: parseNumericAttribute(attributes, "dp_message"),
    });
  }

  return words;
}

export function buildIflytekIseReferenceText(standardText: string): string {
  const trimmed = standardText.trim();
  if (trimmed.startsWith("[content]")) {
    return trimmed;
  }

  return `[content]${trimmed}`;
}

export function normalizeIflytekIseEvaluation(
  response: IflytekIseEvaluationResponse,
  input: {
    referenceText: string;
    mode?: PronunciationMode;
    includeRawXml?: boolean;
  },
): PronunciationEvaluationResult {
  if (response.code !== 0) {
    throw createProviderError({
      provider: IFLYTEK_ISE_PROVIDER_NAME,
      code: "provider_unavailable",
      message: response.message || "iFlytek ISE pronunciation evaluation failed.",
      retryable: response.code === 10114 || response.code === 10160,
      metadata: {
        providerCode: response.code,
        sid: response.sid,
      },
    });
  }

  const xmlPayload = response.data?.data;
  if (!xmlPayload) {
    throw createProviderError({
      provider: IFLYTEK_ISE_PROVIDER_NAME,
      code: "invalid_request",
      message: "iFlytek ISE returned an empty evaluation payload.",
      retryable: false,
    });
  }

  const xml = Buffer.from(xmlPayload, "base64").toString("utf8");
  const scores = parseIflytekIseReadSentenceScores(xml);
  const words = parseIflytekIseWordDetails(xml);
  const fallbackOverall = averageWordScores(words);

  const details: IflytekIseNormalizedDetails = {
    referenceText: input.referenceText,
    recordId: response.sid,
    words,
  };

  if (input.includeRawXml) {
    details.rawXml = xml;
  }

  return {
    provider: IFLYTEK_ISE_PROVIDER_NAME,
    mode: input.mode ?? "shadowing",
    overallScore: scores.totalScore ?? fallbackOverall,
    fluencyScore: scores.fluencyScore,
    accuracyScore: scores.accuracyScore ?? fallbackOverall,
    completenessScore: scores.completenessScore,
    prosodyScore: scores.standardScore,
    details,
    metadata: {
      sid: response.sid,
      wavetimeMs: undefined,
    },
  };
}
