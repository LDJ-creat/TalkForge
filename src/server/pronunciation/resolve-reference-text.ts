import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";

export const MIN_FREE_SPEECH_REFERENCE_WORD_COUNT = 2;

export type ResolvedReferenceTextSource = "transcript" | "turn_fallback";

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
  const transcript = await deps.getTranscriptByTurnId(turnId);
  const transcriptText = transcript?.text?.trim();

  if (transcriptText) {
    return {
      text: transcriptText,
      wordCount: countReferenceWords(transcriptText),
      source: "transcript",
    };
  }

  const turn = await deps.getTurnById(turnId);
  const fallbackText = turn?.transcriptText?.trim();

  if (fallbackText) {
    return {
      text: fallbackText,
      wordCount: countReferenceWords(fallbackText),
      source: "turn_fallback",
    };
  }

  return {
    text: "",
    wordCount: 0,
    source: "turn_fallback",
  };
}

export function isValidFreeSpeechReferenceText(reference: ResolvedReferenceText): boolean {
  return reference.wordCount >= MIN_FREE_SPEECH_REFERENCE_WORD_COUNT;
}
