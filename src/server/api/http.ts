import { AudioUploadServiceError } from "@/server/storage/errors";

export const REQUEST_USER_ID_HEADER = "x-talkforge-user-id";

export function requireRequestUserId(request: Request): string {
  const userId = request.headers.get(REQUEST_USER_ID_HEADER)?.trim();
  if (!userId) {
    throw new AudioUploadServiceError(401, "unauthorized", "Request user id header is required.");
  }
  return userId;
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw error;
    }
    throw new AudioUploadServiceError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof AudioUploadServiceError) {
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

  if (error instanceof SyntaxError) {
    return Response.json(
      {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  console.error(error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}
