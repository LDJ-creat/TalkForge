import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import { getPronunciationProvider } from "@/server/pronunciation/provider";
import { ShadowingServiceError } from "@/server/shadowing/errors";
import { submitShadowingPracticeEvaluation } from "@/server/shadowing/submit-practice-evaluation";

function parseDurationMs(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; itemId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId, itemId } = await context.params;
    const formData = await request.formData();
    const audioEntry = formData.get("audio");
    const durationMs = parseDurationMs(formData.get("durationMs"));

    if (!(audioEntry instanceof File) || audioEntry.size <= 0) {
      throw new ShadowingServiceError(
        400,
        "invalid_request",
        "Practice audio file is required.",
      );
    }

    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new ShadowingServiceError(
        400,
        "invalid_request",
        "durationMs must be a positive number.",
      );
    }

    const audioBody = Buffer.from(await audioEntry.arrayBuffer());
    const result = await submitShadowingPracticeEvaluation(
      {
        sessionId,
        itemId,
        userId,
        audioBody,
        durationMs,
        contentType: audioEntry.type || "audio/webm",
      },
      {
        db: getDb(),
        pronunciationProvider: getPronunciationProvider(),
      },
    );

    return Response.json(result);
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
