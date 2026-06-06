import { describe, expect, it } from "vitest";

import type { RealtimeSessionCredentials } from "@/providers/realtime/types";

import { mapRealtimeCredentials } from "@/features/conversation/credentials";

describe("mapRealtimeCredentials", () => {
  it("maps provider credentials into conversation state shape", () => {
    const credentials: RealtimeSessionCredentials = {
      provider: "mock-realtime",
      providerSessionId: "rt_session_1",
      token: "rt_token_1",
      expiresAt: "2026-06-06T12:00:00.000Z",
      connectionMode: "websocket",
      endpointUrl: "wss://mock.talkforge.local/realtime",
    };

    expect(mapRealtimeCredentials(credentials)).toEqual({
      provider: "mock-realtime",
      providerSessionId: "rt_session_1",
      token: "rt_token_1",
      expiresAt: "2026-06-06T12:00:00.000Z",
      connectionMode: "websocket",
      endpointUrl: "wss://mock.talkforge.local/realtime",
    });
  });
});
