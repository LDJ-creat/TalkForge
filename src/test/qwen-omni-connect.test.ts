import { afterEach, describe, expect, it } from "vitest";

import { mapRealtimeCredentials } from "@/features/conversation/credentials";
import { resolveQwenOmniBrowserWebSocket } from "@/features/conversation/realtime/adapters/qwen-omni-connect";
import { resolveBrowserWebSocketConnection } from "@/features/conversation/realtime/resolve-browser-websocket";
import { QWEN_OMNI_PROVIDER_NAME } from "@/providers/qwen-omni/config";

describe("Qwen Omni browser WebSocket connection", () => {
  const endpointUrl =
    "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-omni-flash-realtime";

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_REALTIME_PROXY_URL;
  });

  it("routes browser traffic through the TalkForge realtime proxy when configured", () => {
    process.env.NEXT_PUBLIC_REALTIME_PROXY_URL = "ws://localhost:3002";

    const credentials = mapRealtimeCredentials({
      provider: QWEN_OMNI_PROVIDER_NAME,
      providerSessionId: "pending:session-1",
      token: "st-browser-token",
      expiresAt: "2026-06-06T12:00:00.000Z",
      connectionMode: "websocket",
      endpointUrl,
    });

    expect(resolveQwenOmniBrowserWebSocket(credentials)).toEqual({
      url: "ws://localhost:3002/realtime?model=qwen3-omni-flash-realtime",
      protocols: ["Bearer", "st-browser-token"],
    });
    expect(resolveBrowserWebSocketConnection(credentials).url).not.toContain(
      "st-browser-token",
    );
    expect(resolveBrowserWebSocketConnection(credentials).url).not.toContain(
      "dashscope.aliyuncs.com",
    );
  });

  it("falls back to the upstream endpoint when no proxy URL is configured", () => {
    const credentials = mapRealtimeCredentials({
      provider: QWEN_OMNI_PROVIDER_NAME,
      providerSessionId: "pending:session-1",
      token: "st-browser-token",
      expiresAt: "2026-06-06T12:00:00.000Z",
      connectionMode: "websocket",
      endpointUrl,
    });

    expect(resolveQwenOmniBrowserWebSocket(credentials)).toEqual({
      url: endpointUrl,
      protocols: ["Bearer", "st-browser-token"],
    });
  });
});
