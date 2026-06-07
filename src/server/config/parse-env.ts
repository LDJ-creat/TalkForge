import { PROVIDER_ENV_KEYS } from "./env-keys";
import path from "node:path";

import {
  MOCK_PROVIDER_NAME,
  type AiTracingConfig,
  type AiTracingRawStorageBackend,
  type DatabaseProviderName,
  type ProviderMode,
  type ProviderSelection,
  type PublicClientConfig,
  type QueueProviderName,
  type RuntimeConfig,
  type RuntimeSecrets,
  type StorageProviderName,
} from "./types";

const DEV_STORAGE_SIGNING_SECRET = "talkforge-dev-storage-secret";

function readEnv(
  env: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function parseOptionalPositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readProviderName(
  env: NodeJS.ProcessEnv,
  envKey: string,
  fallback: string = MOCK_PROVIDER_NAME,
): string {
  return readEnv(env, envKey) ?? fallback;
}

function resolveProviderMode(name: string): ProviderMode {
  return name === MOCK_PROVIDER_NAME ? "mock" : "real";
}

function selection<TName extends string>(name: TName): ProviderSelection<TName> {
  return {
    name,
    mode: resolveProviderMode(name),
  };
}

function resolveStorageMode(name: StorageProviderName): ProviderMode {
  if (name === MOCK_PROVIDER_NAME || name === "local") {
    return "mock";
  }
  return "real";
}

function resolveQueueProviderName(env: NodeJS.ProcessEnv): QueueProviderName {
  const explicit = readEnv(env, PROVIDER_ENV_KEYS.queue);
  if (explicit === "memory" || explicit === "redis") {
    return explicit;
  }
  return readEnv(env, "REDIS_URL") ? "redis" : "memory";
}

function resolveNodeEnv(env: NodeJS.ProcessEnv): RuntimeConfig["nodeEnv"] {
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv === "production" || nodeEnv === "test") {
    return nodeEnv;
  }
  return "development";
}

function parseSecrets(env: NodeJS.ProcessEnv): RuntimeSecrets {
  return {
    realtimeApiKey: readEnv(env, "REALTIME_API_KEY"),
    realtimeApiSecret: readEnv(env, "REALTIME_API_SECRET"),
    realtimeBaseUrl: readEnv(env, "REALTIME_BASE_URL"),
    realtimeModel: readEnv(env, "REALTIME_MODEL"),
    realtimeVoice: readEnv(env, "REALTIME_VOICE"),
    realtimeTokenTtlSec: parseOptionalPositiveInt(readEnv(env, "REALTIME_TOKEN_TTL_SEC")),
    asrApiKey: readEnv(env, "ASR_API_KEY"),
    llmApiKey: readEnv(env, "LLM_API_KEY"),
    ttsApiKey: readEnv(env, "TTS_API_KEY"),
    pronunciationApiKey: readEnv(env, "PRONUNCIATION_API_KEY"),
    pronunciationAppId: readEnv(env, "PRONUNCIATION_APP_ID"),
    storageEndpoint: readEnv(env, "STORAGE_ENDPOINT"),
    storageBucket: readEnv(env, "STORAGE_BUCKET"),
    storageAccessKeyId: readEnv(env, "STORAGE_ACCESS_KEY_ID"),
    storageSecretAccessKey: readEnv(env, "STORAGE_SECRET_ACCESS_KEY"),
    storageRegion: readEnv(env, "STORAGE_REGION"),
    storageSigningSecret: readEnv(env, "STORAGE_SIGNING_SECRET"),
    databaseUrl: readEnv(env, "DATABASE_URL"),
    redisUrl: readEnv(env, "REDIS_URL"),
    localStorageRoot: readEnv(env, "LOCAL_STORAGE_ROOT"),
  };
}

function parsePublicConfig(env: NodeJS.ProcessEnv): PublicClientConfig {
  return {
    appBaseUrl:
      readEnv(env, "NEXT_PUBLIC_APP_BASE_URL") ??
      readEnv(env, "APP_BASE_URL") ??
      "http://localhost:3000",
    devUserId: readEnv(env, "NEXT_PUBLIC_DEV_USER_ID"),
  };
}

function parseBooleanEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: boolean,
): boolean {
  const value = readEnv(env, name);
  if (value === undefined) {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function parseSampleRate(env: NodeJS.ProcessEnv): number {
  const raw = readEnv(env, "AI_TRACING_SAMPLE_RATE");
  if (!raw) {
    return 1;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return 1;
  }
  return parsed;
}

function parseRetentionDays(env: NodeJS.ProcessEnv): number | undefined {
  const raw = readEnv(env, "AI_TRACING_RETENTION_DAYS");
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveRawStorageBackend(
  env: NodeJS.ProcessEnv,
  nodeEnv: RuntimeConfig["nodeEnv"],
): AiTracingRawStorageBackend {
  const explicit = readEnv(env, "AI_TRACING_RAW_STORAGE");
  if (explicit === "file" || explicit === "object" || explicit === "none") {
    return explicit;
  }

  if (nodeEnv === "production") {
    return "object";
  }
  return "file";
}

function parseAiTracingConfig(
  env: NodeJS.ProcessEnv,
  nodeEnv: RuntimeConfig["nodeEnv"],
): AiTracingConfig {
  const enabledDefault = nodeEnv !== "test";
  return {
    enabled: parseBooleanEnv(env, "AI_TRACING_ENABLED", enabledDefault),
    captureRawRequest: parseBooleanEnv(env, "AI_TRACING_RAW_REQUEST", true),
    captureRawResponse: parseBooleanEnv(env, "AI_TRACING_RAW_RESPONSE", true),
    rawStorageBackend: resolveRawStorageBackend(env, nodeEnv),
    sampleRate: parseSampleRate(env),
    retentionDays: parseRetentionDays(env),
    redactPii: parseBooleanEnv(env, "AI_TRACING_REDACT_PII", true),
    localRoot:
      readEnv(env, "AI_TRACING_LOCAL_ROOT") ??
      path.join(process.cwd(), ".storage", "ai-traces"),
  };
}

function usesOnlyMockProviders(
  providers: RuntimeConfig["providers"],
): boolean {
  return (
    providers.realtime.mode === "mock" &&
    providers.asr.mode === "mock" &&
    providers.llmCorrection.mode === "mock" &&
    providers.llmReport.mode === "mock" &&
    providers.llmGoalJudge.mode === "mock" &&
    providers.tts.mode === "mock" &&
    providers.pronunciation.mode === "mock" &&
    providers.storage.mode === "mock" &&
    providers.queue.name === "memory"
  );
}

export function parseRuntimeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const nodeEnv = resolveNodeEnv(env);
  const appBaseUrl = readEnv(env, "APP_BASE_URL") ?? "http://localhost:3000";
  const llmCorrectionName = readProviderName(env, PROVIDER_ENV_KEYS.llmCorrection);
  const llmReportName = readProviderName(
    env,
    PROVIDER_ENV_KEYS.llmReport,
    llmCorrectionName,
  );
  const storageName = readProviderName(
    env,
    PROVIDER_ENV_KEYS.storage,
  ) as StorageProviderName;
  const queueName = resolveQueueProviderName(env);
  const secrets = parseSecrets(env);

  const providers: RuntimeConfig["providers"] = {
    realtime: selection(
      readProviderName(env, PROVIDER_ENV_KEYS.realtime) as RuntimeConfig["providers"]["realtime"]["name"],
    ),
    asr: selection(
      readProviderName(env, PROVIDER_ENV_KEYS.asr) as RuntimeConfig["providers"]["asr"]["name"],
    ),
    llmCorrection: selection(
      llmCorrectionName as RuntimeConfig["providers"]["llmCorrection"]["name"],
    ),
    llmReport: selection(
      llmReportName as RuntimeConfig["providers"]["llmReport"]["name"],
    ),
    llmGoalJudge: selection(
      readProviderName(
        env,
        PROVIDER_ENV_KEYS.llmGoalJudge,
      ) as RuntimeConfig["providers"]["llmGoalJudge"]["name"],
    ),
    tts: selection(
      readProviderName(env, PROVIDER_ENV_KEYS.tts) as RuntimeConfig["providers"]["tts"]["name"],
    ),
    pronunciation: selection(
      readProviderName(
        env,
        PROVIDER_ENV_KEYS.pronunciation,
      ) as RuntimeConfig["providers"]["pronunciation"]["name"],
    ),
    storage: {
      name: storageName,
      mode: resolveStorageMode(storageName),
    },
    database: {
      name: readProviderName(env, PROVIDER_ENV_KEYS.database, "postgres") as DatabaseProviderName,
      mode: "real",
    },
    queue: selection(queueName),
  };

  return {
    nodeEnv,
    appBaseUrl,
    providers,
    secrets,
    public: parsePublicConfig(env),
    aiTracing: parseAiTracingConfig(env, nodeEnv),
    usesOnlyMockProviders: usesOnlyMockProviders(providers),
  };
}

export function resolveStorageSigningSecret(
  config: RuntimeConfig,
): string {
  const configured = config.secrets.storageSigningSecret;
  if (config.nodeEnv === "production") {
    if (!configured) {
      throw new Error(
        "STORAGE_SIGNING_SECRET is required when NODE_ENV=production.",
      );
    }
    return configured;
  }
  return configured ?? DEV_STORAGE_SIGNING_SECRET;
}
