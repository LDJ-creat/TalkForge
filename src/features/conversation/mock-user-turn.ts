import { getClientTurnAudioCacheAdapter } from "@/lib/audio-cache/client-adapter";
import { uploadTurnAudioFromCacheEntry } from "@/lib/audio-cache/handoff";
import { resolveClientRequestUserId } from "@/shared/request-user";

import { createTurnOnServer } from "./create-turn-api";
import type { TranscriptEntry } from "./types";

export const MOCK_USER_TURN_LINES = [
  "Could I get a medium latte, please?",
  "Can I have it iced with oat milk?",
  "Yes, that's correct. Thank you.",
] as const;

export const MOCK_ASSISTANT_REPLIES = [
  "Sure! Would you like that hot or iced?",
  "Great choice. Anything else for you today?",
  "Perfect. That will be $5.50. Have a nice day!",
] as const;

const MOCK_AUDIO_DURATION_MS = 2_500;

export function createMockUserAudioBlob(): Blob {
  return new Blob([new Uint8Array([0])], { type: "audio/webm" });
}

export type SubmitMockUserTurnInput = {
  sessionId: string;
  transcriptText: string;
  turnIndex: number;
  userId?: string;
};

export type SubmitMockUserTurnResult = {
  turnId: string;
  userTranscript: TranscriptEntry;
  assistantTranscript: TranscriptEntry;
};

function createTranscriptEntry(
  role: TranscriptEntry["role"],
  text: string,
  status: TranscriptEntry["status"] = "final",
): TranscriptEntry {
  return {
    id: `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    status,
    timestamp: new Date().toISOString(),
  };
}

export async function submitMockUserTurn(
  input: SubmitMockUserTurnInput,
): Promise<SubmitMockUserTurnResult> {
  const userId = resolveClientRequestUserId(input.userId);
  const { turn } = await createTurnOnServer({
    sessionId: input.sessionId,
    role: "user",
    transcriptText: input.transcriptText,
    userId,
  });

  const adapter = getClientTurnAudioCacheAdapter();
  await adapter.save({
    turnId: turn.id,
    sessionId: input.sessionId,
    blob: createMockUserAudioBlob(),
    durationMs: MOCK_AUDIO_DURATION_MS,
  });

  await uploadTurnAudioFromCacheEntry(adapter, {
    userId,
    turnId: turn.id,
    sessionId: input.sessionId,
    durationMs: MOCK_AUDIO_DURATION_MS,
  });

  const assistantText =
    MOCK_ASSISTANT_REPLIES[input.turnIndex % MOCK_ASSISTANT_REPLIES.length] ??
    MOCK_ASSISTANT_REPLIES[0];

  await createTurnOnServer({
    sessionId: input.sessionId,
    role: "assistant",
    transcriptText: assistantText,
    userId,
  });

  return {
    turnId: turn.id,
    userTranscript: createTranscriptEntry("user", input.transcriptText, "final"),
    assistantTranscript: createTranscriptEntry("assistant", assistantText, "final"),
  };
}

export function getNextMockUserTurnLine(turnIndex: number): string {
  return (
    MOCK_USER_TURN_LINES[turnIndex % MOCK_USER_TURN_LINES.length] ??
    MOCK_USER_TURN_LINES[0]
  );
}
