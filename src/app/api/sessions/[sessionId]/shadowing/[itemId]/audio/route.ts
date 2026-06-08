import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import {
  getSessionById,
  getShadowingItemById,
} from "@/server/db/repositories";
import { ShadowingServiceError } from "@/server/shadowing/errors";
import { fetchShadowingItemAudioForUser } from "@/server/shadowing/fetch-shadowing-item-audio";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string; itemId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId, itemId } = await context.params;
    const db = getDb();

    return await fetchShadowingItemAudioForUser(sessionId, itemId, userId, {
      getSessionById: (id) => getSessionById(db, id),
      getShadowingItemById: (id) => getShadowingItemById(db, id),
    });
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
