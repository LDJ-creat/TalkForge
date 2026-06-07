/** Server-only environment variable names. Never prefix these with NEXT_PUBLIC_. */
export const SERVER_SECRET_ENV_KEYS = [
  "REALTIME_API_KEY",
  "REALTIME_API_SECRET",
  "REALTIME_BASE_URL",
  "REALTIME_MODEL",
  "REALTIME_VOICE",
  "REALTIME_TOKEN_TTL_SEC",
  "ASR_API_KEY",
  "ASR_BASE_URL",
  "ASR_MODEL",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "TTS_API_KEY",
  "PRONUNCIATION_API_KEY",
  "PRONUNCIATION_APP_ID",
  "STORAGE_ENDPOINT",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "STORAGE_REGION",
  "STORAGE_SIGNING_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "LOCAL_STORAGE_ROOT",
] as const;

export type ServerSecretEnvKey = (typeof SERVER_SECRET_ENV_KEYS)[number];

export const PROVIDER_ENV_KEYS = {
  realtime: "REALTIME_PROVIDER",
  asr: "ASR_PROVIDER",
  llmCorrection: "LLM_CORRECTION_PROVIDER",
  llmReport: "LLM_REPORT_PROVIDER",
  llmGoalJudge: "LLM_GOAL_JUDGE_PROVIDER",
  tts: "TTS_PROVIDER",
  pronunciation: "PRONUNCIATION_PROVIDER",
  storage: "STORAGE_PROVIDER",
  database: "DATABASE_PROVIDER",
  queue: "QUEUE_PROVIDER",
} as const;

export const PUBLIC_CLIENT_ENV_KEYS = [
  "NEXT_PUBLIC_APP_BASE_URL",
  "NEXT_PUBLIC_DEV_USER_ID",
] as const;

const FORBIDDEN_PUBLIC_ENV_FRAGMENTS = [
  "API_KEY",
  "SECRET",
  "PASSWORD",
  "PRIVATE_KEY",
  "DATABASE_URL",
  "REDIS_URL",
  "ACCESS_KEY",
] as const;

export function findPublicEnvLeaks(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const issues: string[] = [];

  for (const key of Object.keys(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) {
      continue;
    }

    for (const fragment of FORBIDDEN_PUBLIC_ENV_FRAGMENTS) {
      if (key.includes(fragment)) {
        issues.push(
          `Environment variable "${key}" must not be exposed to the browser. Move it to a server-only variable.`,
        );
        break;
      }
    }
  }

  return issues;
}
