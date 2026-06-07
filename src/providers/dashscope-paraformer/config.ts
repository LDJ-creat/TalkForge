export const DASHSCOPE_PARAFORMER_PROVIDER_NAME = "dashscope-paraformer-asr" as const;

export const DEFAULT_DASHSCOPE_API_BASE_URL = "https://dashscope.aliyuncs.com";

export const DEFAULT_DASHSCOPE_PARAFORMER_MODEL = "paraformer-realtime-8k-v2";

export const PARAFORMER_8K_SAMPLE_RATE = 8000;

/** 100ms of mono PCM s16le at 8kHz. */
export const PARAFORMER_PCM_CHUNK_BYTES = 1600;

export type DashScopeParaformerProviderConfig = {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
};

export function buildDashScopeInferenceWebSocketUrl(apiBaseUrl: string): string {
  const normalized = apiBaseUrl.replace(/\/+$/, "");
  return normalized
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .concat("/api-ws/v1/inference");
}
