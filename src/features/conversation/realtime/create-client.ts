import type { ConversationRealtimeCredentials } from "../credentials";

import type { RealtimeClient } from "./client-types";
import { createMockRealtimeClient } from "./mock-client";
import { createWebsocketRealtimeClient, isMockRealtimeProvider } from "./websocket-client";

export function createRealtimeClient(
  credentials: ConversationRealtimeCredentials,
): RealtimeClient {
  if (isMockRealtimeProvider(credentials.provider)) {
    return createMockRealtimeClient();
  }

  return createWebsocketRealtimeClient();
}
