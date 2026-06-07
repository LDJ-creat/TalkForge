import { afterEach, describe, expect, it, vi } from "vitest";

import { mapRealtimeCredentials } from "@/features/conversation/credentials";
import { createWebsocketRealtimeClient } from "@/features/conversation/realtime/websocket-client";
import { QWEN_OMNI_PROVIDER_NAME } from "@/providers/qwen-omni/config";

type MockSocket = {
  url: string;
  protocols?: string | string[];
  listeners: Record<string, Array<(event?: { data?: string }) => void>>;
  sent: string[];
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  addEventListener: (type: string, handler: (event?: { data?: string }) => void) => void;
  send: (payload: string) => void;
};

function createMockSocket(url: string, protocols?: string | string[]): MockSocket {
  const listeners: MockSocket["listeners"] = {};
  const socket: MockSocket = {
    url,
    protocols,
    listeners,
    sent: [],
    readyState: 1,
    close: vi.fn(),
    addEventListener(type, handler) {
      listeners[type] = listeners[type] ?? [];
      listeners[type]!.push(handler);
    },
    send(payload) {
      socket.sent.push(payload);
    },
  };

  queueMicrotask(() => {
    for (const handler of listeners.open ?? []) {
      handler();
    }
  });

  return socket;
}

describe("websocket realtime client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens Qwen Omni connections with bearer subprotocol auth", async () => {
    const sockets: MockSocket[] = [];
    const client = createWebsocketRealtimeClient((url, protocols) => {
      const socket = createMockSocket(url, protocols);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    });

    const credentials = mapRealtimeCredentials({
      provider: QWEN_OMNI_PROVIDER_NAME,
      providerSessionId: "pending:session-1",
      token: "st-browser-token",
      expiresAt: "2026-06-06T12:00:00.000Z",
      connectionMode: "websocket",
      endpointUrl:
        "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-omni-flash-realtime",
      metadata: {
        sessionUpdateEvent: {
          type: "session.update",
          session: { instructions: "test" },
        },
      },
    });

    await client.connect(credentials);

    expect(sockets[0]?.protocols).toEqual(["Bearer", "st-browser-token"]);
    expect(sockets[0]?.url).not.toContain("st-browser-token");
    expect(sockets[0]?.sent[0]).toContain("session.update");
  });
});
