import { afterEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { generateScenarioSystemInstructions } from "@/domain/scenario-prompt";
import {
  buildQwenOmniRealtimeEndpoint,
  buildQwenOmniSessionConfig,
  buildQwenOmniSessionUpdateEvent,
  buildQwenOmniTokenUrl,
  createQwenOmniRealtimeProvider,
  DEFAULT_QWEN_OMNI_API_BASE_URL,
  DEFAULT_QWEN_OMNI_MODEL,
  mintQwenOmniTemporaryToken,
  QWEN_OMNI_PROVIDER_NAME,
  resolveQwenOmniEndpoints,
} from "@/providers/qwen-omni";

describe("Qwen Omni realtime config", () => {
  it("derives websocket endpoints from the HTTP API base URL", () => {
    expect(resolveQwenOmniEndpoints("https://dashscope.aliyuncs.com")).toEqual({
      apiBaseUrl: "https://dashscope.aliyuncs.com",
      websocketBaseUrl: "wss://dashscope.aliyuncs.com/api-ws/v1",
    });
  });

  it("builds the browser WebSocket URL with the configured model", () => {
    const endpoints = resolveQwenOmniEndpoints(DEFAULT_QWEN_OMNI_API_BASE_URL);

    expect(buildQwenOmniRealtimeEndpoint(endpoints, DEFAULT_QWEN_OMNI_MODEL)).toBe(
      "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-omni-flash-realtime",
    );
  });

  it("builds the token minting URL with expiry seconds", () => {
    const endpoints = resolveQwenOmniEndpoints(DEFAULT_QWEN_OMNI_API_BASE_URL);

    expect(buildQwenOmniTokenUrl(endpoints, 300)).toBe(
      "https://dashscope.aliyuncs.com/api/v1/tokens?expire_in_seconds=300",
    );
  });
});

describe("Qwen Omni session config", () => {
  it("includes scenario system instructions in the session.update payload", () => {
    const instructions = generateScenarioSystemInstructions(coffeeOrderingScenario);
    const sessionConfig = buildQwenOmniSessionConfig({
      instructions,
      voice: "Cherry",
    });
    const updateEvent = buildQwenOmniSessionUpdateEvent(sessionConfig);

    expect(updateEvent.type).toBe("session.update");
    expect(updateEvent.session.instructions).toBe(instructions);
    expect(updateEvent.session.modalities).toEqual(["text", "audio"]);
    expect(updateEvent.session.turn_detection.type).toBe("server_vad");
  });
});

describe("mintQwenOmniTemporaryToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a short-lived token and expiry timestamp", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "st-test-token",
          expires_at: 1_744_080_369,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const endpoints = resolveQwenOmniEndpoints(DEFAULT_QWEN_OMNI_API_BASE_URL);
    const result = await mintQwenOmniTemporaryToken({
      apiKey: "sk-test",
      endpoints,
      expireInSec: 300,
      providerName: QWEN_OMNI_PROVIDER_NAME,
    });

    expect(result).toEqual({
      token: "st-test-token",
      expiresAt: new Date(1_744_080_369 * 1000).toISOString(),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope.aliyuncs.com/api/v1/tokens?expire_in_seconds=300",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer sk-test",
        },
      }),
    );
  });

  it("maps authentication failures to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "InvalidApiKey",
            message: "Invalid API-key provided.",
          }),
          { status: 401 },
        ),
      ),
    );

    await expect(
      mintQwenOmniTemporaryToken({
        apiKey: "bad-key",
        endpoints: resolveQwenOmniEndpoints(DEFAULT_QWEN_OMNI_API_BASE_URL),
        expireInSec: 60,
        providerName: QWEN_OMNI_PROVIDER_NAME,
      }),
    ).rejects.toMatchObject({
      code: "authentication",
      provider: QWEN_OMNI_PROVIDER_NAME,
    });
  });
});

describe("QwenOmniRealtimeProvider.createSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns websocket credentials with scenario session metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            token: "st-browser-token",
            expires_at: 1_744_080_369,
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = createQwenOmniRealtimeProvider({
      apiKey: "sk-test",
    });
    const instructions = generateScenarioSystemInstructions(coffeeOrderingScenario);
    const credentials = await provider.createSession({
      userId: "user-1",
      sessionId: "session-1",
      scenarioId: coffeeOrderingScenario.id,
      systemInstructions: instructions,
      expiresInSec: 600,
    });

    expect(credentials.provider).toBe(QWEN_OMNI_PROVIDER_NAME);
    expect(credentials.connectionMode).toBe("websocket");
    expect(credentials.token).toBe("st-browser-token");
    expect(credentials.providerSessionId).toBe("pending:session-1");
    expect(credentials.endpointUrl).toContain("model=qwen3-omni-flash-realtime");
    expect(credentials.metadata).toMatchObject({
      userId: "user-1",
      sessionId: "session-1",
      scenarioId: coffeeOrderingScenario.id,
      instructionsIncluded: true,
      providerSessionIdPending: true,
      browserWebSocketAuth: "sec-websocket-protocol-bearer",
    });
    expect(credentials.metadata?.sessionUpdateEvent).toMatchObject({
      type: "session.update",
      session: {
        instructions,
      },
    });
  });
});
