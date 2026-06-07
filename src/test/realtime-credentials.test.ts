import { describe, expect, it } from "vitest";

import { mapRealtimeCredentials } from "@/features/conversation/credentials";
import { QWEN_OMNI_PROVIDER_NAME } from "@/providers/qwen-omni/config";

describe("mapRealtimeCredentials", () => {
  it("normalizes qwen3.5 Cherry voice to Tina in session.update metadata", () => {
    const mapped = mapRealtimeCredentials({
      provider: QWEN_OMNI_PROVIDER_NAME,
      providerSessionId: "pending:session-1",
      token: "token",
      expiresAt: "2026-06-07T00:00:00.000Z",
      connectionMode: "websocket",
      endpointUrl: "wss://example.com/realtime?model=qwen3.5-omni-flash-realtime",
      metadata: {
        model: "qwen3.5-omni-flash-realtime",
        voice: "Cherry",
        sessionUpdateEvent: {
          type: "session.update",
          session: {
            voice: "Cherry",
            modalities: ["text", "audio"],
          },
        },
      },
    });

    expect(mapped.metadata?.voice).toBe("Tina");
    expect(
      (mapped.metadata?.sessionUpdateEvent as { session: { voice: string } }).session.voice,
    ).toBe("Tina");
  });
});
