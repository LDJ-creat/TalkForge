import type { TranscriptEntry } from "./types";

export type ServerTurnTranscript = {
  id: string;
  role: "user" | "assistant";
  transcriptText?: string;
  startedAt: string;
};

export function mergeTranscriptsWithServerTurns(
  existing: TranscriptEntry[],
  serverTurns: ServerTurnTranscript[],
): TranscriptEntry[] {
  const fromServer = serverTurns
    .filter((turn) => turn.transcriptText?.trim())
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
    .map((turn) => ({
      id: turn.id,
      role: turn.role,
      text: turn.transcriptText!.trim(),
      status: "final" as const,
      timestamp: turn.startedAt,
    }));

  if (fromServer.length === 0) {
    return existing;
  }

  const opening = existing[0];
  if (opening?.role === "assistant" && !fromServer.some((entry) => entry.id === opening.id)) {
    return [opening, ...fromServer];
  }

  return fromServer;
}
