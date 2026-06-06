import { jsonError, readJsonBody, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import { createTurnAudioUploadTarget } from "@/server/storage/audio-upload";
import { getStorageProvider } from "@/server/storage/provider";

type UploadTargetRequestBody = {
  sizeBytes?: number;
  contentType?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; turnId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId, turnId } = await context.params;
    const body = await readJsonBody<UploadTargetRequestBody>(request);
    const result = await createTurnAudioUploadTarget(getDb(), getStorageProvider(), {
      sessionId,
      turnId,
      userId,
      sizeBytes: body.sizeBytes,
      contentType: body.contentType,
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}