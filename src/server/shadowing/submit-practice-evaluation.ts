import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import { buildTurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import type { ShadowingItem } from "@/domain/shadowing";
import type { Session } from "@/domain/session";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import { createAudioSegment } from "@/server/db/repositories/audio-segment-repository";
import { getShadowingItemById } from "@/server/db/repositories/shadowing-item-repository";
import { getSessionById } from "@/server/db/repositories/scenario-session-repository";
import {
  createTurn,
  linkTurnAudioSegment,
  updateTurnEvaluationStatus,
} from "@/server/db/repositories/turn-repository";
import {
  saveShadowingEvaluationForTurnIfAbsent,
} from "@/server/db/repositories/pronunciation-evaluation-repository";
import type { TalkForgeDatabase } from "@/server/db/client";

import { ShadowingServiceError } from "./errors";
import {
  evaluateAndSaveShadowingAttempt,
  ShadowingEvaluationError,
} from "./evaluate-shadowing";
import { persistTurnPracticeAudio } from "./persist-practice-audio";

const MIN_PRACTICE_DURATION_MS = 300;
const MAX_PRACTICE_AUDIO_BYTES = 5 * 1024 * 1024;

export type SubmitShadowingPracticeEvaluationInput = {
  sessionId: string;
  itemId: string;
  userId: string;
  audioBody: Buffer;
  durationMs: number;
  contentType?: string;
};

export type SubmitShadowingPracticeEvaluationDeps = {
  db: TalkForgeDatabase;
  pronunciationProvider: PronunciationEvaluationProvider;
  getSessionById?: (sessionId: string) => Promise<Session | null>;
  getShadowingItemById?: (itemId: string) => Promise<ShadowingItem | null>;
};

export type SubmitShadowingPracticeEvaluationResult = {
  turnId: string;
  feedback: TurnPronunciationFeedback;
};

export async function submitShadowingPracticeEvaluation(
  input: SubmitShadowingPracticeEvaluationInput,
  deps: SubmitShadowingPracticeEvaluationDeps,
): Promise<SubmitShadowingPracticeEvaluationResult> {
  if (input.durationMs < MIN_PRACTICE_DURATION_MS) {
    throw new ShadowingServiceError(
      400,
      "recording_too_short",
      "Recording is too short. Hold the microphone button a little longer.",
    );
  }

  if (input.audioBody.byteLength <= 0 || input.audioBody.byteLength > MAX_PRACTICE_AUDIO_BYTES) {
    throw new ShadowingServiceError(
      400,
      "invalid_audio_payload",
      "Uploaded practice audio is empty or exceeds the size limit.",
    );
  }

  const getSession =
    deps.getSessionById ?? ((sessionId) => getSessionById(deps.db, sessionId));
  const getItem =
    deps.getShadowingItemById ?? ((itemId) => getShadowingItemById(deps.db, itemId));

  const session = await getSession(input.sessionId);
  if (!session || session.userId !== input.userId) {
    throw new ShadowingServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.status !== "completed") {
    throw new ShadowingServiceError(
      409,
      "session_not_completed",
      "Shadowing practice evaluation is only available after the session completes.",
    );
  }

  const item = await getItem(input.itemId);
  if (!item || item.sessionId !== input.sessionId) {
    throw new ShadowingServiceError(
      404,
      "shadowing_item_not_found",
      "Shadowing item was not found.",
    );
  }

  const standardText = item.standardText.trim();
  const endedAt = new Date().toISOString();
  const startedAt = new Date(Date.now() - input.durationMs).toISOString();

  const turn = await createTurn(deps.db, {
    sessionId: input.sessionId,
    role: "user",
    startedAt,
    endedAt,
    transcriptText: standardText,
    evaluationStatus: "pending",
  });

  const { objectKey, sizeBytes } = await persistTurnPracticeAudio({
    sessionId: input.sessionId,
    turnId: turn.id,
    body: input.audioBody,
    contentType: input.contentType,
  });

  const audioSegment = await deps.db.transaction(async (tx) => {
    const segment = await createAudioSegment(tx, {
      turnId: turn.id,
      objectKey,
      format: "webm",
      codec: "opus",
      durationMs: input.durationMs,
      sizeBytes,
    });

    await linkTurnAudioSegment(tx, turn.id, segment.id);
    return segment;
  });

  try {
    const saved = await evaluateAndSaveShadowingAttempt(
      {
        turnId: turn.id,
        audioObjectKey: audioSegment.objectKey,
        standardText,
      },
      {
        pronunciationProvider: deps.pronunciationProvider,
        saveShadowingEvaluationForTurnIfAbsent: (evaluationInput) =>
          saveShadowingEvaluationForTurnIfAbsent(deps.db, evaluationInput),
      },
    );

    await updateTurnEvaluationStatus(deps.db, turn.id, "done");

    const feedback =
      buildTurnPronunciationFeedback({
        evaluationStatus: "done",
        evaluation: saved.evaluation,
      }) ?? { evaluationStatus: "done" };

    return {
      turnId: turn.id,
      feedback,
    };
  } catch (error) {
    await updateTurnEvaluationStatus(deps.db, turn.id, "failed");

    if (error instanceof ShadowingEvaluationError) {
      throw new ShadowingServiceError(
        error.code === "validation" ? 400 : 502,
        error.code,
        error.message,
      );
    }

    throw error;
  }
}
