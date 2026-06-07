import { describe, expect, it } from "vitest";

import { mapRealtimeCredentials } from "@/features/conversation/credentials";
import { resolveQwenOmniBrowserWebSocket } from "@/features/conversation/realtime/adapters/qwen-omni-connect";
import { resolveBrowserWebSocketConnection } from "@/features/conversation/realtime/resolve-browser-websocket";
import { QWEN_OMNI_PROVIDER_NAME } from "@/providers/qwen-omni/config";

describe("Qwen Omni browser WebSocket connection", () => {
  it("uses Sec-WebSocket-Protocol bearer auth instead of query tokens", () => {
    const credentials = mapRealtimeCredentials({
      provider: QWEN_OMNI_PROVIDER_NAME,
      providerSessionId: "pending:session-1",
      token: "st-browser-token",
      expiresAt: "2026-06-06T12:00:00.000Z",
      connectionMode: "websocket",
      endpointUrl:
        "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-omni-flash-realtime",
    });

    expect(resolveQwenOmniBrowserWebSocket(credentials)).toEqual({
      url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-omni-flash-realtime",
      protocols: ["Bearer", "st-browser-token"],
    });
    expect(resolveBrowserWebSocketConnection(credentials).url).not.toContain(
      "st-browser-token",
    );
  });
});
