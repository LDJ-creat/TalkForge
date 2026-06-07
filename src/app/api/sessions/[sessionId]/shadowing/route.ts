import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import {
  getSessionById,
  listShadowingItemsBySessionId,
} from "@/server/db/repositories";
import { ShadowingServiceError } from "@/server/shadowing/errors";
import { fetchSessionShadowingForUser } from "@/server/shadowing/fetch-session-shadowing";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;

    const items = await fetchSessionShadowingForUser(sessionId, userId, {
      getSessionById: (id) => getSessionById(getDb(), id),
      listShadowingItemsBySessionId: (id) =>
        listShadowingItemsBySessionId(getDb(), id),
    });

    return Response.json({ items });
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
