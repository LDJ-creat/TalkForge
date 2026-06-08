import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export function buildShadowingItemAudioUrl(sessionId: string, itemId: string): string {
  return `/api/sessions/${sessionId}/shadowing/${encodeURIComponent(itemId)}/audio`;
}

export async function fetchShadowingItemAudioBlob(
  sessionId: string,
  itemId: string,
  userId?: string,
): Promise<Blob> {
  const resolvedUserId = resolveClientRequestUserId(userId);
  const response = await fetch(buildShadowingItemAudioUrl(sessionId, itemId), {
    headers: {
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `Failed to fetch shadowing audio (${response.status}).`,
    );
  }

  return response.blob();
}
