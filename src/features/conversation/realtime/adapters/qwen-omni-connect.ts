import { QWEN_OMNI_PROVIDER_NAME } from "@/providers/qwen-omni/config";

import type { ConversationRealtimeCredentials } from "../../credentials";

export type BrowserWebSocketConnection = {
  url: string;
  protocols?: string[];
};

export function resolveQwenOmniBrowserProxyBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_REALTIME_PROXY_URL?.trim();
  if (!configured) {
    return null;
  }

  return configured.replace(/\/+$/, "");
}

export function buildQwenOmniBrowserProxyWebSocketUrl(
  endpointUrl: string,
  proxyBaseUrl: string,
): string {
  const upstream = new URL(endpointUrl);
  const model = upstream.searchParams.get("model");

  if (!model) {
    throw new Error("Realtime endpoint URL is missing the model query parameter.");
  }

  const proxyUrl = new URL("/realtime", `${proxyBaseUrl}/`);
  proxyUrl.searchParams.set("model", model);
  return proxyUrl.toString();
}

/**
 * DashScope realtime requires `Authorization: Bearer <token>` on the upstream
 * handshake. Browsers cannot set that header, and DashScope rejects
 * Sec-WebSocket-Protocol bearer auth with 401. Route browser traffic through
 * the local TalkForge realtime proxy, which adds the Authorization header.
 */
export function resolveQwenOmniBrowserWebSocket(
  credentials: ConversationRealtimeCredentials,
): BrowserWebSocketConnection {
  if (!credentials.endpointUrl) {
    throw new Error("Realtime endpoint URL is missing.");
  }

  if (!credentials.token) {
    throw new Error("Realtime session token is missing.");
  }

  const proxyBaseUrl = resolveQwenOmniBrowserProxyBaseUrl();
  const url = proxyBaseUrl
    ? buildQwenOmniBrowserProxyWebSocketUrl(credentials.endpointUrl, proxyBaseUrl)
    : credentials.endpointUrl;

  return {
    url,
    protocols: ["Bearer", credentials.token],
  };
}

export function isQwenOmniRealtimeProvider(provider: string): boolean {
  return provider === QWEN_OMNI_PROVIDER_NAME;
}
