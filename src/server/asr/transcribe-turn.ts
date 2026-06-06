import type { AudioSegment } from "@/domain/audio-segment";
import type { CreateTranscriptInput } from "@/domain/transcript";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import type { AsrProvider } from "@/providers/asr/contract";
import { isProviderError } from "@/providers/errors";
import type { QueueAdapter } from "@/queue/adapter";
import {
  enqueueCorrectionAnalyzeJob,
  enqueueEvaluationFreeSpeechJob,
  enqueueScenarioProgressEvaluateJob,
} from "@/queue/enqueue";
import { JobProcessingError } from "@/queue/errors";
import type { AsrTranscribePayload } from "@/queue/payloads";

export type AsrTranscribeTurnResult = {
  transcript: Transcript;
  created: boolean;
  downstreamJobsEnqueued: boolean;
};

export type AsrTranscribeTurnDeps = {
  asrProvider: AsrProvider;
  queueAdapter?: QueueAdapter;
  getTurnById: (turnId: string) => Promise<Turn | null>;
  getAudioSegmentById: (audioSegmentId: string) => Promise<AudioSegment | null>;
  getTranscriptByTurnId: (turnId: string) => Promise<Transcript | null>;
  persistTranscriptForTurn: (
    input: CreateTranscriptInput,
  ) => Promise<{ transcript: Transcript; created: boolean }>;
};

export async function transcribeTurnAudio(
  payload: AsrTranscribePayload,
  deps: AsrTranscribeTurnDeps,
  context: { attempts: number },
): Promise<AsrTranscribeTurnResult> {
  const turn = await deps.getTurnById(payload.turnId);
  if (!turn || turn.sessionId !== payload.sessionId) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Turn ${payload.turnId} was not found for session ${payload.sessionId}.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  const audioSegment = await deps.getAudioSegmentById(payload.audioSegmentId);
  if (!audioSegment || audioSegment.turnId !== payload.turnId) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Audio segment ${payload.audioSegmentId} was not found for turn ${payload.turnId}.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  if (audioSegment.objectKey !== payload.audioObjectKey) {
    throw new JobProcessingError({
      code: "validation",
      message: "Audio object key does not match the persisted audio segment.",
      attempts: context.attempts,
      retryable: false,
      metadata: {
        expectedObjectKey: audioSegment.objectKey,
        payloadObjectKey: payload.audioObjectKey,
      },
    });
  }

  const existingTranscript = await deps.getTranscriptByTurnId(payload.turnId);
  if (existingTranscript) {
    const downstreamJobsEnqueued = await enqueueDownstreamJobs(
      deps,
      payload,
      existingTranscript.id,
      turn,
    );

    return {
      transcript: existingTranscript,
      created: false,
      downstreamJobsEnqueued,
    };
  }

  let transcription;
  try {
    transcription = await deps.asrProvider.transcribe({
      audioObjectKey: payload.audioObjectKey,
      language: payload.language ?? "en",
      wordTimestamps: true,
    });
  } catch (error) {
    throw mapProviderErrorToJobError(error, {
      provider: deps.asrProvider.name,
      attempts: context.attempts,
    });
  }

  const { transcript, created } = await deps.persistTranscriptForTurn({
    turnId: payload.turnId,
    provider: transcription.provider,
    text: transcription.text,
    confidence: transcription.confidence,
    segments: transcription.segments,
  });

  const downstreamJobsEnqueued = await enqueueDownstreamJobs(
    deps,
    payload,
    transcript.id,
    turn,
  );

  return {
    transcript,
    created,
    downstreamJobsEnqueued,
  };
}

async function enqueueDownstreamJobs(
  deps: AsrTranscribeTurnDeps,
  payload: AsrTranscribePayload,
  transcriptId: string,
  turn: Turn,
): Promise<boolean> {
  if (!deps.queueAdapter) {
    return false;
  }

  await enqueueCorrectionAnalyzeJob(deps.queueAdapter, {
    turnId: payload.turnId,
    sessionId: payload.sessionId,
    transcriptId,
  });
  await enqueueEvaluationFreeSpeechJob(deps.queueAdapter, {
    turnId: payload.turnId,
    sessionId: payload.sessionId,
    audioSegmentId: payload.audioSegmentId,
  });

  if (turn.role === "user") {
    await enqueueScenarioProgressEvaluateJob(deps.queueAdapter, {
      sessionId: payload.sessionId,
      triggerTurnId: payload.turnId,
    });
  }

  return true;
}

function mapProviderErrorToJobError(
  error: unknown,
  context: { provider: string; attempts: number },
): JobProcessingError {
  if (isProviderError(error)) {
    const code =
      error.code === "not_found"
        ? "not_found"
        : error.code === "invalid_request" || error.code === "configuration"
          ? "validation"
          : error.code === "timeout"
            ? "timeout"
            : "processing";

    return new JobProcessingError({
      code,
      message: error.message,
      attempts: context.attempts,
      retryable: error.retryable,
      cause: error,
      metadata: {
        provider: context.provider,
        providerCode: error.code,
      },
    });
  }

  return new JobProcessingError({
    code: "processing",
    message: error instanceof Error ? error.message : "ASR transcription failed.",
    attempts: context.attempts,
    retryable: true,
    cause: error,
  });
}
