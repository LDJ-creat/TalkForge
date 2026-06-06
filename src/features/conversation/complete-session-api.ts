import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export async function completeSessionOnServer(sessionId: string, userId?: string) {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(`/api/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: {
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
  });

  if (response.ok) {
    return (await response.json()) as {
      session: { id: string; status: string };
      reportJobEnqueued: boolean;
    };
  }

  if (response.status === 404) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;

  throw new Error(
    body?.error?.message ?? `Failed to complete session (${response.status}).`,
  );
}
