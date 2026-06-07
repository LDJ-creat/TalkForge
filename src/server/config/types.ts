import type { SessionUsageLimitsConfig } from "@/domain/session-usage-limits";

export const MOCK_PROVIDER_NAME = "mock" as const;

export type ProviderMode = "mock" | "real";

/** Implemented: mock, qwen-omni. "doubao" is planned but not wired yet. */
export type RealtimeProviderName =
  | typeof MOCK_PROVIDER_NAME
  | "qwen-omni"
  | (string & {});

export type AsrProviderName = typeof MOCK_PROVIDER_NAME | "paraformer" | (string & {});

export type TextLlmProviderName = typeof MOCK_PROVIDER_NAME | (string & {});

export type TtsProviderName = typeof MOCK_PROVIDER_NAME | "cosyvoice" | (string & {});

export type PronunciationProviderName =
  | typeof MOCK_PROVIDER_NAME
  | "iflytek-ise"
  | (string & {});

export type StorageProviderName =
  | typeof MOCK_PROVIDER_NAME
  | "local"
  | "s3"
  | "r2"
  | "oss"
  | "minio"
  | (string & {});

export type QueueProviderName = "memory" | "redis";

export type DatabaseProviderName = "postgres";

export type ProviderSelection<TName extends string = string> = {
  name: TName;
  mode: ProviderMode;
};

export type RuntimeSecrets = {
  realtimeApiKey?: string;
  realtimeApiSecret?: string;
  realtimeBaseUrl?: string;
  realtimeModel?: string;
  realtimeVoice?: string;
  realtimeTokenTtlSec?: number;
  asrApiKey?: string;
  asrBaseUrl?: string;
  asrModel?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  ttsApiKey?: string;
  ttsBaseUrl?: string;
  ttsModel?: string;
  ttsVoice?: string;
  pronunciationApiKey?: string;
  pronunciationApiSecret?: string;
  pronunciationAppId?: string;
  pronunciationWsBaseUrl?: string;
  storageEndpoint?: string;
  storageBucket?: string;
  storageAccessKeyId?: string;
  storageSecretAccessKey?: string;
  storageRegion?: string;
  storageSigningSecret?: string;
  databaseUrl?: string;
  redisUrl?: string;
  localStorageRoot?: string;
  opsHealthDetailToken?: string;
};

export type PublicClientConfig = {
  appBaseUrl: string;
  devUserId?: string;
};

export type AiTracingRawStorageBackend = "file" | "object" | "none";

export type AiTracingConfig = {
  enabled: boolean;
  captureRawRequest: boolean;
  captureRawResponse: boolean;
  rawStorageBackend: AiTracingRawStorageBackend;
  sampleRate: number;
  /**
   * Hint for downstream retention jobs (for example P1-014 cleanup). This value
   * is not enforced automatically when traces are written.
   */
  retentionDays?: number;
  redactPii: boolean;
  localRoot: string;
};

export type ScenarioProgressConfig = {
  /**
   * Run the scenario progress judge after every N user turns. Always runs at
   * session end regardless of this interval.
   */
  judgeUserTurnInterval: number;
};

export type { SessionUsageLimitsConfig };

export type RuntimeConfig = {
  nodeEnv: "development" | "production" | "test";
  appBaseUrl: string;
  scenarioProgress: ScenarioProgressConfig;
  sessionUsageLimits: SessionUsageLimitsConfig;
  providers: {
    realtime: ProviderSelection<RealtimeProviderName>;
    asr: ProviderSelection<AsrProviderName>;
    llmCorrection: ProviderSelection<TextLlmProviderName>;
    llmReport: ProviderSelection<TextLlmProviderName>;
    llmGoalJudge: ProviderSelection<TextLlmProviderName>;
    llmScenarioGenerate: ProviderSelection<TextLlmProviderName>;
    tts: ProviderSelection<TtsProviderName>;
    pronunciation: ProviderSelection<PronunciationProviderName>;
    storage: ProviderSelection<StorageProviderName>;
    database: ProviderSelection<DatabaseProviderName>;
    queue: ProviderSelection<QueueProviderName>;
  };
  secrets: RuntimeSecrets;
  public: PublicClientConfig;
  aiTracing: AiTracingConfig;
  usesOnlyMockProviders: boolean;
};
