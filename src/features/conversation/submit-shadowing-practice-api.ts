import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export type SubmitShadowingPracticeResult = {
  turnId: string;
  feedback: TurnPronunciationFeedback;
};

export async function submitShadowingPracticeRecording(
  input: {
    sessionId: string;
    itemId: string;
    audioBlob: Blob;
    durationMs: number;
    userId?: string;
  },
): Promise<SubmitShadowingPracticeResult> {
  const userId = resolveClientRequestUserId(input.userId);
  const formData = new FormData();
  formData.append(
    "audio",
    input.audioBlob,
    `shadowing-practice-${input.itemId}.webm`,
  );
  formData.append("durationMs", String(Math.round(input.durationMs)));

  const response = await fetch(
    `/api/sessions/${input.sessionId}/shadowing/${encodeURIComponent(input.itemId)}/evaluate`,
    {
      method: "POST",
      headers: {
        [REQUEST_USER_ID_HEADER]: userId,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ??
        `Failed to evaluate shadowing practice (${response.status}).`,
    );
  }

  return response.json() as Promise<SubmitShadowingPracticeResult>;
}
