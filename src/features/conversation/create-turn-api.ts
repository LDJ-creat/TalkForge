import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export type CreateTurnOnServerInput = {
  sessionId: string;
  role: "user" | "assistant";
  transcriptText?: string;
  userId?: string;
};

export type CreateTurnOnServerResult = {
  turn: {
    id: string;
    sessionId: string;
    role: "user" | "assistant";
    startedAt: string;
    endedAt: string;
    transcriptText?: string;
  };
};

export async function createTurnOnServer(
  input: CreateTurnOnServerInput,
): Promise<CreateTurnOnServerResult> {
  const userId = resolveClientRequestUserId(input.userId);

  const response = await fetch(`/api/sessions/${input.sessionId}/turns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [REQUEST_USER_ID_HEADER]: userId,
    },
    body: JSON.stringify({
      role: input.role,
      transcriptText: input.transcriptText,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Failed to create turn (${response.status}).`);
  }

  return response.json() as Promise<CreateTurnOnServerResult>;
}

export async function fetchSessionTurnsFromServer(sessionId: string, userId?: string) {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(`/api/sessions/${sessionId}/turns`, {
    headers: {
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Failed to fetch turns (${response.status}).`);
  }

  return response.json() as Promise<{
    turns: Array<{
      id: string;
      role: "user" | "assistant";
      transcriptText?: string;
      startedAt: string;
    }>;
  }>;
}
