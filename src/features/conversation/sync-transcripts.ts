import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import type { EvaluationStatus } from "@/domain/enums";

import type { TranscriptEntry } from "./types";

export type ServerTurnTranscript = {
  id: string;
  role: "user" | "assistant";
  transcriptText?: string;
  startedAt: string;
  evaluationStatus?: EvaluationStatus;
  pronunciationFeedback?: TurnPronunciationFeedback;
};

function toTranscriptEntry(turn: ServerTurnTranscript): TranscriptEntry {
  return {
    id: turn.id,
    role: turn.role,
    text: turn.transcriptText!.trim(),
    status: "final",
    timestamp: turn.startedAt,
    pronunciationFeedback: turn.pronunciationFeedback,
  };
}

function findMatchingEntryByText(
  entries: TranscriptEntry[],
  turn: ServerTurnTranscript,
): TranscriptEntry | undefined {
  const text = turn.transcriptText?.trim();
  if (!text) {
    return undefined;
  }

  return entries.find(
    (entry) => entry.role === turn.role && entry.text.trim() === text,
  );
}

function findMatchingEntryByRoleAndTimestamp(
  entries: TranscriptEntry[],
  turn: ServerTurnTranscript,
): TranscriptEntry | undefined {
  return entries.find(
    (entry) => entry.role === turn.role && entry.timestamp === turn.startedAt,
  );
}

export function mergeTranscriptsWithServerTurns(
  existing: TranscriptEntry[],
  serverTurns: ServerTurnTranscript[],
): TranscriptEntry[] {
  if (serverTurns.length === 0) {
    return existing;
  }

  const serverById = new Map(serverTurns.map((turn) => [turn.id, turn]));
  const consumedServerIds = new Set<string>();

  const mergedExisting = existing.map((entry) => {
    const serverTurn = serverById.get(entry.id);
    if (serverTurn) {
      consumedServerIds.add(serverTurn.id);
      return {
        ...entry,
        text: serverTurn.transcriptText?.trim() || entry.text,
        pronunciationFeedback:
          serverTurn.pronunciationFeedback ?? entry.pronunciationFeedback,
      };
    }

    const matchedByText = serverTurns.find(
      (turn) =>
        !consumedServerIds.has(turn.id) &&
        findMatchingEntryByText([entry], turn) !== undefined,
    );

    if (matchedByText?.transcriptText?.trim()) {
      consumedServerIds.add(matchedByText.id);
      return {
        ...entry,
        id: matchedByText.id,
        text: matchedByText.transcriptText.trim(),
        timestamp: matchedByText.startedAt,
        pronunciationFeedback:
          matchedByText.pronunciationFeedback ?? entry.pronunciationFeedback,
      };
    }

    const matchedByTimestamp = serverTurns.find(
      (turn) =>
        !consumedServerIds.has(turn.id) &&
        turn.transcriptText?.trim() &&
        findMatchingEntryByRoleAndTimestamp([entry], turn) !== undefined,
    );

    if (matchedByTimestamp?.transcriptText?.trim()) {
      consumedServerIds.add(matchedByTimestamp.id);
      return {
        ...entry,
        id: matchedByTimestamp.id,
        text: matchedByTimestamp.transcriptText.trim(),
        timestamp: matchedByTimestamp.startedAt,
        pronunciationFeedback:
          matchedByTimestamp.pronunciationFeedback ??
          entry.pronunciationFeedback,
      };
    }

    return entry;
  });

  const additional = serverTurns
    .filter(
      (turn) =>
        turn.transcriptText?.trim() &&
        !consumedServerIds.has(turn.id) &&
        !mergedExisting.some((entry) => entry.id === turn.id),
    )
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
    .map((turn) => toTranscriptEntry(turn));

  const combined =
    additional.length > 0 ? [...mergedExisting, ...additional] : mergedExisting;

  if (combined.length === 0) {
    return existing;
  }

  const opening = existing[0];
  if (
    opening?.role === "assistant" &&
    !combined.some((entry) => entry.id === opening.id)
  ) {
    return [opening, ...combined];
  }

  return combined;
}

export function applyServerTurnUpdate(
  transcripts: TranscriptEntry[],
  serverTurn: ServerTurnTranscript,
): TranscriptEntry[] {
  return mergeTranscriptsWithServerTurns(transcripts, [serverTurn]);
}
