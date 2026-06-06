import { jsonError, readJsonBody, requireRequestUserId } from "@/server/api/http";
import { AudioUploadServiceError } from "@/server/storage/errors";
import { getDb } from "@/server/db/client";
import { getQueueAdapter } from "@/server/queue/provider";
import { processEnqueuedJobsSafely } from "@/server/queue/dev-worker";
import { finalizeTurnAudioUpload } from "@/server/storage/audio-upload";
import { getStorageProvider } from "@/server/storage/provider";

type FinalizeRequestBody = {
  objectKey: string;
  durationMs: number;
  sizeBytes: number;
  format?: "webm" | "wav" | "pcm";
  codec?: "opus" | "pcm_s16le";
  sampleRate?: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; turnId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId, turnId } = await context.params;
    const body = await readJsonBody<FinalizeRequestBody>(request);

    if (!body.objectKey || body.durationMs <= 0 || body.sizeBytes <= 0) {
      throw new AudioUploadServiceError(
        400,
        "invalid_audio_metadata",
        "Audio duration and size must be greater than zero.",
      );
    }

    const result = await finalizeTurnAudioUpload(
      getDb(),
      getStorageProvider(),
      {
        sessionId,
        turnId,
        userId,
        objectKey: body.objectKey,
        durationMs: body.durationMs,
        sizeBytes: body.sizeBytes,
        format: body.format,
        codec: body.codec,
        sampleRate: body.sampleRate,
      },
      { queueAdapter: getQueueAdapter() },
    );

    await processEnqueuedJobsSafely();

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}