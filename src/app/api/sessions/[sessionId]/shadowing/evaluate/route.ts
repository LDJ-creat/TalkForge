import { jsonError, readJsonBody, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import { getAudioSegmentById, getSessionById, getTurnById } from "@/server/db/repositories";
import { getQueueAdapter } from "@/server/queue/provider";
import { processEnqueuedJobsSafely } from "@/server/queue/dev-worker";
import { ShadowingServiceError } from "@/server/shadowing/errors";
import { enqueueShadowingEvaluation } from "@/server/shadowing/enqueue-evaluation";

type EvaluateShadowingRequestBody = {
  turnId: string;
  audioSegmentId: string;
  standardText: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;
    const body = await readJsonBody<EvaluateShadowingRequestBody>(request);

    if (!body.turnId || !body.audioSegmentId || !body.standardText?.trim()) {
      throw new ShadowingServiceError(
        400,
        "invalid_request",
        "turnId, audioSegmentId, and standardText are required.",
      );
    }

    const job = await enqueueShadowingEvaluation(
      {
        sessionId,
        turnId: body.turnId,
        audioSegmentId: body.audioSegmentId,
        standardText: body.standardText,
        userId,
      },
      {
        db: getDb(),
        queueAdapter: getQueueAdapter(),
        getSessionById: (id) => getSessionById(getDb(), id),
        getTurnById: (id) => getTurnById(getDb(), id),
        getAudioSegmentById: (id) => getAudioSegmentById(getDb(), id),
      },
    );

    await processEnqueuedJobsSafely();

    return Response.json({ job });
  } catch (error) {
    if (error instanceof ShadowingServiceError) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    return jsonError(error);
  }
}
