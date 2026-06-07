import { findPublicEnvLeaks } from "./env-keys";
import { RuntimeConfigError } from "./errors";
import type { RuntimeConfig } from "./types";
import { isKnownTextLlmProviderName } from "@/providers/openai-compatible-text-llm";

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

function requireTextLlmBaseUrl(
  issues: string[],
  providerName: string,
  llmBaseUrl: string | undefined,
  providerLabel: string,
): void {
  if (providerName === "mock" || isKnownTextLlmProviderName(providerName)) {
    return;
  }

  if (!llmBaseUrl) {
    issues.push(
      `LLM_BASE_URL is required when ${providerLabel}="${providerName}" uses a custom OpenAI-compatible provider id.`,
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
    requireTextLlmBaseUrl(
      issues,
      providers.llmCorrection.name,
      secrets.llmBaseUrl,
      "LLM_CORRECTION_PROVIDER",
    );
  }

  if (providers.llmReport.mode === "real") {
    requireSecret(
      issues,
      secrets.llmApiKey,
      "LLM_API_KEY",
      `LLM_REPORT_PROVIDER="${providers.llmReport.name}"`,
    );
    requireTextLlmBaseUrl(
      issues,
      providers.llmReport.name,
      secrets.llmBaseUrl,
      "LLM_REPORT_PROVIDER",
    );
  }

  if (providers.llmGoalJudge.mode === "real") {
    requireSecret(
      issues,
      secrets.llmApiKey,
      "LLM_API_KEY",
      `LLM_GOAL_JUDGE_PROVIDER="${providers.llmGoalJudge.name}"`,
    );
    requireTextLlmBaseUrl(
      issues,
      providers.llmGoalJudge.name,
      secrets.llmBaseUrl,
      "LLM_GOAL_JUDGE_PROVIDER",
    );
  }

  if (providers.llmScenarioGenerate.mode === "real") {
    requireSecret(
      issues,
      secrets.llmApiKey,
      "LLM_API_KEY",
      `LLM_SCENARIO_GENERATE_PROVIDER="${providers.llmScenarioGenerate.name}"`,
    );
    requireTextLlmBaseUrl(
      issues,
      providers.llmScenarioGenerate.name,
      secrets.llmBaseUrl,
      "LLM_SCENARIO_GENERATE_PROVIDER",
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
    requireSecret(
      issues,
      secrets.pronunciationApiSecret,
      "PRONUNCIATION_API_SECRET",
      `PRONUNCIATION_PROVIDER="${providers.pronunciation.name}"`,
    );
    requireSecret(
      issues,
      secrets.pronunciationAppId,
      "PRONUNCIATION_APP_ID",
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

    if (providers.storage.name === "oss") {
      requireSecret(
        issues,
        secrets.storageRegion,
        "STORAGE_REGION",
        `STORAGE_PROVIDER="oss"`,
      );
    }
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
