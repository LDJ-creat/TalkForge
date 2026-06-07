import type { ConversationRealtimeCredentials } from "../credentials";

import {
  isQwenOmniRealtimeProvider,
  resolveQwenOmniBrowserWebSocket,
} from "./adapters/qwen-omni-connect";
import type { BrowserWebSocketConnection } from "./adapters/qwen-omni-connect";

export function resolveBrowserWebSocketConnection(
  credentials: ConversationRealtimeCredentials,
): BrowserWebSocketConnection {
  if (isQwenOmniRealtimeProvider(credentials.provider)) {
    return resolveQwenOmniBrowserWebSocket(credentials);
  }

  if (!credentials.endpointUrl) {
    throw new Error("Realtime endpoint URL is missing.");
  }

  return {
    url: credentials.endpointUrl,
  };
}
