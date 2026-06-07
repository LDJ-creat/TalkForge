import { findPublicEnvLeaks } from "./env-keys";
import { RuntimeConfigError } from "./errors";
import type { RuntimeConfig } from "./types";

function requireSecret(
  issues: string[],
  value: string | undefined,
  envKey: string,
  providerLabel: string,
): void {
  if (!value) {
    issues.push(
      `${envKey} is required when ${providerLabel} is enabled with a real provider.`,
    );
  }
}

export function collectRuntimeConfigIssues(
  config: RuntimeConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const issues = [...findPublicEnvLeaks(env)];
  const { providers, secrets, nodeEnv } = config;

  if (nodeEnv === "production") {
    requireSecret(issues, secrets.databaseUrl, "DATABASE_URL", "database");
    requireSecret(
      issues,
      secrets.storageSigningSecret,
      "STORAGE_SIGNING_SECRET",
      "production storage signing",
    );
  }

  if (providers.realtime.mode === "real") {
    requireSecret(
      issues,
      secrets.realtimeApiKey,
      "REALTIME_API_KEY",
      `REALTIME_PROVIDER="${providers.realtime.name}"`,
    );
  }

  if (providers.asr.mode === "real") {
    requireSecret(
      issues,
      secrets.asrApiKey,
      "ASR_API_KEY",
      `ASR_PROVIDER="${providers.asr.name}"`,
    );
  }

  if (providers.llmCorrection.mode === "real") {
    requireSecret(
      issues,
      secrets.llmApiKey,
      "LLM_API_KEY",
      `LLM_CORRECTION_PROVIDER="${providers.llmCorrection.name}"`,
    );
  }

  if (providers.llmReport.mode === "real") {
    requireSecret(
      issues,
      secrets.llmApiKey,
      "LLM_API_KEY",
      `LLM_REPORT_PROVIDER="${providers.llmReport.name}"`,
    );
  }

  if (providers.llmGoalJudge.mode === "real") {
    requireSecret(
      issues,
      secrets.llmApiKey,
      "LLM_API_KEY",
      `LLM_GOAL_JUDGE_PROVIDER="${providers.llmGoalJudge.name}"`,
    );
  }

  if (providers.tts.mode === "real") {
    requireSecret(
      issues,
      secrets.ttsApiKey,
      "TTS_API_KEY",
      `TTS_PROVIDER="${providers.tts.name}"`,
    );
  }

  if (providers.pronunciation.mode === "real") {
    requireSecret(
      issues,
      secrets.pronunciationApiKey,
      "PRONUNCIATION_API_KEY",
      `PRONUNCIATION_PROVIDER="${providers.pronunciation.name}"`,
    );
  }

  if (providers.storage.mode === "real") {
    requireSecret(
      issues,
      secrets.storageEndpoint,
      "STORAGE_ENDPOINT",
      `STORAGE_PROVIDER="${providers.storage.name}"`,
    );
    requireSecret(
      issues,
      secrets.storageBucket,
      "STORAGE_BUCKET",
      `STORAGE_PROVIDER="${providers.storage.name}"`,
    );
    requireSecret(
      issues,
      secrets.storageAccessKeyId,
      "STORAGE_ACCESS_KEY_ID",
      `STORAGE_PROVIDER="${providers.storage.name}"`,
    );
    requireSecret(
      issues,
      secrets.storageSecretAccessKey,
      "STORAGE_SECRET_ACCESS_KEY",
      `STORAGE_PROVIDER="${providers.storage.name}"`,
    );
  }

  if (providers.queue.name === "redis") {
    requireSecret(
      issues,
      secrets.redisUrl,
      "REDIS_URL",
      'QUEUE_PROVIDER="redis"',
    );
  }

  if (providers.database.name !== "postgres") {
    issues.push(
      `DATABASE_PROVIDER="${providers.database.name}" is unsupported. Use "postgres".`,
    );
  }

  return issues;
}

export function validateRuntimeConfig(
  config: RuntimeConfig,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const issues = collectRuntimeConfigIssues(config, env);
  if (issues.length > 0) {
    throw new RuntimeConfigError(issues);
  }
  return config;
}
