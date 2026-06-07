import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";

export const MIN_FREE_SPEECH_REFERENCE_WORD_COUNT = 2;

export type ResolvedReferenceTextSource = "realtime" | "transcript";

export type ResolvedReferenceText = {
  text: string;
  wordCount: number;
  source: ResolvedReferenceTextSource;
};

export type ResolveReferenceTextDeps = {
  getTranscriptByTurnId: (turnId: string) => Promise<Transcript | null>;
  getTurnById: (turnId: string) => Promise<Turn | null>;
};

export function countReferenceWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

export async function resolveReferenceTextForTurn(
  turnId: string,
  deps: ResolveReferenceTextDeps,
): Promise<ResolvedReferenceText> {
  const turn = await deps.getTurnById(turnId);
  const realtimeText = turn?.transcriptText?.trim();

  if (realtimeText) {
    return {
      text: realtimeText,
      wordCount: countReferenceWords(realtimeText),
      source: "realtime",
    };
  }

  const transcript = await deps.getTranscriptByTurnId(turnId);
  const legacyText = transcript?.text?.trim();

  if (legacyText) {
    return {
      text: legacyText,
      wordCount: countReferenceWords(legacyText),
      source: "transcript",
    };
  }

  return {
    text: "",
    wordCount: 0,
    source: "realtime",
  };
}

export function isValidFreeSpeechReferenceText(reference: ResolvedReferenceText): boolean {
  return reference.wordCount >= MIN_FREE_SPEECH_REFERENCE_WORD_COUNT;
}
