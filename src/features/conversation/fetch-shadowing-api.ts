import type { ShadowingItem } from "@/domain/shadowing";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export async function fetchSessionShadowingFromServer(
  sessionId: string,
  userId?: string,
): Promise<ShadowingItem[]> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch(`/api/sessions/${sessionId}/shadowing`, {
    headers: {
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `Failed to fetch shadowing items (${response.status}).`,
    );
  }

  const body = (await response.json()) as { items: ShadowingItem[] };
  return body.items;
}

export async function pollSessionShadowingFromServer(
  sessionId: string,
  options: {
    userId?: string;
    attempts?: number;
    intervalMs?: number;
  } = {},
): Promise<ShadowingItem[]> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 750;

  for (let index = 0; index < attempts; index += 1) {
    const items = await fetchSessionShadowingFromServer(sessionId, options.userId);
    if (items.length > 0) {
      return items;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  return [];
}
