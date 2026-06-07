import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export async function skipTurnEvaluationOnServer(
  sessionId: string,
  turnId: string,
  userId?: string,
): Promise<void> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(
    `/api/sessions/${sessionId}/turns/${turnId}/skip-evaluation`,
    {
      method: "POST",
      headers: {
        [REQUEST_USER_ID_HEADER]: resolvedUserId,
      },
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `Failed to skip turn evaluation (${response.status}).`,
    );
  }
}
