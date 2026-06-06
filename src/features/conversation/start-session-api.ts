import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

import { mapRealtimeCredentials } from "./credentials";
import type { ConversationRealtimeCredentials } from "./credentials";
import type { ConversationSession } from "./types";

export type StartSessionOnServerResult = {
  session: ConversationSession & { backendLinked: true };
  realtimeCredentials: ConversationRealtimeCredentials;
};

export async function startSessionOnServer(
  scenarioId: string,
  userId?: string,
): Promise<StartSessionOnServerResult | null> {
  let resolvedUserId: string;
  try {
    resolvedUserId = resolveClientRequestUserId(userId);
  } catch {
    return null;
  }

  let response: Response;
  try {
    response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [REQUEST_USER_ID_HEADER]: resolvedUserId,
      },
      body: JSON.stringify({ scenarioId }),
    });
  } catch {
    return null;
  }

  if (
    response.status === 404 ||
    response.status === 401 ||
    response.status >= 500
  ) {
    return null;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Failed to start session (${response.status}).`);
  }

  const body = (await response.json()) as {
    session: {
      id: string;
      scenarioId: string;
      status: ConversationSession["status"];
      startedAt: string;
      realtimeProvider?: string;
    };
    realtimeCredentials: Parameters<typeof mapRealtimeCredentials>[0];
  };

  return {
    session: {
      id: body.session.id,
      scenarioId: body.session.scenarioId,
      status: body.session.status,
      startedAt: body.session.startedAt,
      realtimeProvider: body.session.realtimeProvider,
      backendLinked: true,
    },
    realtimeCredentials: mapRealtimeCredentials(body.realtimeCredentials),
  };
}
