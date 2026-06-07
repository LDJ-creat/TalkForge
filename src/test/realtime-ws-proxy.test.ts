import { afterEach, describe, expect, it } from "vitest";

import {
  buildQwenOmniBrowserProxyWebSocketUrl,
  resolveQwenOmniBrowserProxyBaseUrl,
} from "@/features/conversation/realtime/adapters/qwen-omni-connect";
import {
  resolveRealtimeProxyPort,
  shouldStartRealtimeWebSocketProxy,
  stopRealtimeWebSocketProxyForTests,
} from "@/server/realtime/ws-proxy";

describe("realtime ws proxy config", () => {
  afterEach(() => {
    delete process.env.REALTIME_PROVIDER;
    delete process.env.REALTIME_PROXY_ENABLED;
    delete process.env.REALTIME_PROXY_PORT;
    delete process.env.NEXT_PUBLIC_REALTIME_PROXY_URL;
    stopRealtimeWebSocketProxyForTests();
  });

  it("starts only for qwen-omni unless explicitly disabled", () => {
    process.env.REALTIME_PROVIDER = "mock";
    expect(shouldStartRealtimeWebSocketProxy()).toBe(false);

    process.env.REALTIME_PROVIDER = "qwen-omni";
    expect(shouldStartRealtimeWebSocketProxy()).toBe(true);

    process.env.REALTIME_PROXY_ENABLED = "false";
    expect(shouldStartRealtimeWebSocketProxy()).toBe(false);
  });

  it("resolves proxy port from env with a safe default", () => {
    expect(resolveRealtimeProxyPort()).toBe(3002);
    process.env.REALTIME_PROXY_PORT = "3010";
    expect(resolveRealtimeProxyPort()).toBe(3010);
  });

  it("builds browser proxy URLs from upstream model query params", () => {
    process.env.NEXT_PUBLIC_REALTIME_PROXY_URL = "ws://localhost:3002/";
    expect(resolveQwenOmniBrowserProxyBaseUrl()).toBe("ws://localhost:3002");
    expect(
      buildQwenOmniBrowserProxyWebSocketUrl(
        "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3.5-omni-flash-realtime",
        "ws://localhost:3002",
      ),
    ).toBe("ws://localhost:3002/realtime?model=qwen3.5-omni-flash-realtime");
  });
});
