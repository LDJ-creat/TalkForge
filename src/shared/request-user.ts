export const REQUEST_USER_ID_HEADER = "x-talkforge-user-id";

export function resolveClientRequestUserId(explicitUserId?: string): string {
  if (explicitUserId?.trim()) {
    return explicitUserId.trim();
  }

  const fromEnv =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DEV_USER_ID?.trim() : undefined;
  if (fromEnv) {
    return fromEnv;
  }

  throw new Error(
    "A TalkForge user id is required. Pass userId to the upload helper or set NEXT_PUBLIC_DEV_USER_ID.",
  );
}
