export const QWEN_OMNI_PROVIDER_NAME = "qwen-omni-realtime" as const;

export const DEFAULT_QWEN_OMNI_MODEL = "qwen3-omni-flash-realtime";
export const DEFAULT_QWEN_OMNI_VOICE = "Cherry";
export const DEFAULT_QWEN_OMNI_API_BASE_URL = "https://dashscope.aliyuncs.com";
export const DEFAULT_QWEN_OMNI_TOKEN_TTL_SEC = 300;
export const MAX_QWEN_OMNI_TOKEN_TTL_SEC = 1800;

export type QwenOmniEndpointConfig = {
  apiBaseUrl: string;
  websocketBaseUrl: string;
};

export type QwenOmniProviderConfig = {
  apiKey: string;
  model: string;
  voice: string;
  tokenTtlSec: number;
  endpoints: QwenOmniEndpointConfig;
};

export function resolveQwenOmniEndpoints(apiBaseUrl: string): QwenOmniEndpointConfig {
  const normalized = apiBaseUrl.replace(/\/+$/, "");
  const websocketBaseUrl = normalized
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .concat("/api-ws/v1");

  return {
    apiBaseUrl: normalized,
    websocketBaseUrl,
  };
}

export function buildQwenOmniRealtimeEndpoint(
  endpoints: QwenOmniEndpointConfig,
  model: string,
): string {
  const url = new URL(`${endpoints.websocketBaseUrl}/realtime`);
  url.searchParams.set("model", model);
  return url.toString();
}

export function buildQwenOmniTokenUrl(
  endpoints: QwenOmniEndpointConfig,
  expireInSec: number,
): string {
  const url = new URL(`${endpoints.apiBaseUrl}/api/v1/tokens`);
  url.searchParams.set("expire_in_seconds", String(expireInSec));
  return url.toString();
}
