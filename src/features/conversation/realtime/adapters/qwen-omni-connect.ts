import { QWEN_OMNI_PROVIDER_NAME } from "@/providers/qwen-omni/config";

import type { ConversationRealtimeCredentials } from "../../credentials";

export type BrowserWebSocketConnection = {
  url: string;
  protocols?: string[];
};

/**
 * DashScope realtime expects `Authorization: Bearer <token>` on the handshake.
 * Browser WebSocket cannot set HTTP headers, so we pass the short-lived token
 * through Sec-WebSocket-Protocol per the provider's browser guidance.
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

  return {
    url: credentials.endpointUrl,
    protocols: ["Bearer", credentials.token],
  };
}

export function isQwenOmniRealtimeProvider(provider: string): boolean {
  return provider === QWEN_OMNI_PROVIDER_NAME;
}
