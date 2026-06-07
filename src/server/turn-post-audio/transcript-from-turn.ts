import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";

export const REALTIME_TRANSCRIPT_PROVIDER = "qwen-omni-realtime" as const;

export function buildTranscriptFromTurn(turn: Turn): Transcript | null {
  const text = turn.transcriptText?.trim();
  if (!text) {
    return null;
  }

  return {
    id: `realtime:${turn.id}`,
    turnId: turn.id,
    provider: REALTIME_TRANSCRIPT_PROVIDER,
    text,
    segments: [{ startMs: 0, endMs: 0, text }],
  };
}
