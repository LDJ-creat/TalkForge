import { assertShadowingStandardText, ShadowingValidationError } from "@/domain/shadowing";
import { enqueueEvaluationShadowingJob } from "@/queue";
import type { QueueAdapter } from "@/queue/adapter";
import type { JobSnapshot } from "@/queue/status";
import type { AudioSegment } from "@/domain/audio-segment";
import type { Session } from "@/domain/session";
import type { Turn } from "@/domain/turn";

import type { TalkForgeDatabase } from "../db/client";
import { ShadowingServiceError } from "./errors";

export type EnqueueShadowingEvaluationInput = {
  sessionId: string;
  turnId: string;
  audioSegmentId: string;
  standardText: string;
  userId: string;
};

export type EnqueueShadowingEvaluationDeps = {
  db: TalkForgeDatabase;
  queueAdapter: QueueAdapter;
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getTurnById: (turnId: string) => Promise<Turn | null>;
  getAudioSegmentById: (audioSegmentId: string) => Promise<AudioSegment | null>;
};

export async function enqueueShadowingEvaluation(
  input: EnqueueShadowingEvaluationInput,
  deps: EnqueueShadowingEvaluationDeps,
): Promise<JobSnapshot<"evaluation.shadowing">> {
  try {
    assertShadowingStandardText(input.standardText);
  } catch (error) {
    if (error instanceof ShadowingValidationError) {
      throw new ShadowingServiceError(
        400,
        "invalid_standard_text",
        error.message,
      );
    }
    throw error;
  }

  const session = await deps.getSessionById(input.sessionId);
  if (!session || session.userId !== input.userId) {
    throw new ShadowingServiceError(
      404,
      "session_not_found",
      `Session ${input.sessionId} was not found.`,
    );
  }

  const turn = await deps.getTurnById(input.turnId);
  if (!turn || turn.sessionId !== input.sessionId) {
    throw new ShadowingServiceError(
      404,
      "turn_not_found",
      `Turn ${input.turnId} was not found for session ${input.sessionId}.`,
    );
  }

  const audioSegment = await deps.getAudioSegmentById(input.audioSegmentId);
  if (!audioSegment || audioSegment.turnId !== input.turnId) {
    throw new ShadowingServiceError(
      404,
      "audio_segment_not_found",
      `Audio segment ${input.audioSegmentId} was not found for turn ${input.turnId}.`,
    );
  }

  return enqueueEvaluationShadowingJob(deps.queueAdapter, {
    sessionId: input.sessionId,
    turnId: input.turnId,
    audioSegmentId: input.audioSegmentId,
    standardText: input.standardText.trim(),
  });
}
