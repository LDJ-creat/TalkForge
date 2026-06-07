import type { AsrTranscriptionResult } from "@/providers/asr/types";

import { DASHSCOPE_PARAFORMER_PROVIDER_NAME } from "./config";
import type { DashScopeParaformerSentence } from "./types";

function sentenceToSegment(
  sentence: DashScopeParaformerSentence,
  includeWords: boolean,
) {
  const endMs =
    sentence.end_time ??
    (sentence.words && sentence.words.length > 0
      ? sentence.words[sentence.words.length - 1]?.end_time
      : sentence.begin_time) ??
    sentence.begin_time;

  return {
    startMs: sentence.begin_time,
    endMs,
    text: sentence.text.trim(),
    words:
      includeWords && sentence.words
        ? sentence.words.map((word) => ({
            word: word.text.trim(),
            startMs: word.begin_time,
            endMs: word.end_time,
            confidence: undefined,
          }))
        : undefined,
  };
}

function averageEmoConfidence(sentences: DashScopeParaformerSentence[]): number | undefined {
  const values = sentences
    .map((sentence) => sentence.emo_confidence)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function normalizeDashScopeParaformerResponse(
  sentences: DashScopeParaformerSentence[],
  options: {
    audioObjectKey: string;
    language?: "en";
    wordTimestamps?: boolean;
    durationSec?: number;
  },
): AsrTranscriptionResult {
  const completedSentences = sentences.filter(
    (sentence) => sentence.sentence_end && sentence.heartbeat !== true,
  );
  const text = completedSentences.map((sentence) => sentence.text.trim()).join(" ").trim();

  return {
    provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
    text,
    confidence: averageEmoConfidence(completedSentences),
    segments: completedSentences.map((sentence) =>
      sentenceToSegment(sentence, options.wordTimestamps === true),
    ),
    metadata: {
      audioObjectKey: options.audioObjectKey,
      language: options.language ?? "en",
      durationSec: options.durationSec,
      sentenceCount: completedSentences.length,
    },
  };
}
