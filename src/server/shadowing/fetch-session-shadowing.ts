import type { ShadowingItem } from "@/domain/shadowing";
import type { Session } from "@/domain/session";

import { ShadowingServiceError } from "./errors";

export type FetchSessionShadowingDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  listShadowingItemsBySessionId: (sessionId: string) => Promise<ShadowingItem[]>;
};

export async function fetchSessionShadowingForUser(
  sessionId: string,
  userId: string,
  deps: FetchSessionShadowingDeps,
): Promise<ShadowingItem[]> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new ShadowingServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new ShadowingServiceError(
      403,
      "forbidden",
      "You do not have access to this session.",
    );
  }

  return deps.listShadowingItemsBySessionId(sessionId);
}
