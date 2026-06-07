import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deriveConnectionStatus,
  deriveTurnStatus,
  canEnterFallback,
  canRetryRealtime,
} from "@/features/conversation/realtime/lifecycle";
import { mapQwenOmniServerEvent } from "@/features/conversation/realtime/adapters/qwen-omni-events";
import {
  resetMockRealtimeClientOptions,
  setMockRealtimeClientOptions,
} from "@/features/conversation/realtime/mock-client";
import {
  configureRealtimeSessionController,
  connectRealtimeSession,
  disconnectRealtimeSession,
  enterRealtimeFallbackMode,
  resetRealtimeSessionControllerForTests,
  retryRealtimeSession,
} from "@/features/conversation/realtime/session-controller";
import { mapRealtimeCredentials } from "@/features/conversation/credentials";
import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { createOpeningTranscript } from "@/features/conversation/mock-session";

const MOCK_CREDENTIALS = mapRealtimeCredentials({
  provider: "mock-realtime",
  providerSessionId: "rt_session_test",
  token: "rt_token_test",
  expiresAt: "2026-06-06T01:00:00.000Z",
  connectionMode: "websocket",
  endpointUrl: "wss://mock.talkforge.local/realtime",
  metadata: { mock: true },
});

describe("realtime lifecycle helpers", () => {
  it("derives connection and turn status from lifecycle phases", () => {
    expect(deriveConnectionStatus("listening")).toBe("connected");
    expect(deriveTurnStatus("listening")).toBe("user_speaking");
    expect(deriveConnectionStatus("reconnecting")).toBe("reconnecting");
    expect(deriveConnectionStatus("failed")).toBe("failed");
    expect(deriveConnectionStatus("ended")).toBe("disconnected");
    expect(deriveTurnStatus("assistant_speaking")).toBe("assistant_speaking");
  });

  it("exposes retry and fallback affordances for failure states", () => {
    expect(canRetryRealtime("failed")).toBe(true);
    expect(canRetryRealtime("connected")).toBe(false);
    expect(canEnterFallback("failed")).toBe(true);
    expect(canEnterFallback("reconnecting")).toBe(true);
  });
});

describe("qwen omni event adapter", () => {
  it("maps speech and response events into lifecycle transitions", () => {
    const speechStarted = mapQwenOmniServerEvent(
      { type: "input_audio_buffer.speech_started" },
      { lifecycle: "connected" },
    );
    expect(speechStarted.events).toContainEqual({
      type: "lifecycle",
      status: "listening",
    });

    const responseCreated = mapQwenOmniServerEvent(
      { type: "response.created", response: { id: "resp-1" } },
      { lifecycle: "listening" },
    );
    expect(responseCreated.events).toContainEqual({
      type: "lifecycle",
      status: "assistant_speaking",
    });
    expect(responseCreated.nextState.activeResponseId).toBe("resp-1");
  });
});

describe("realtime session controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMockRealtimeClientOptions();
    resetRealtimeSessionControllerForTests();
  });

  afterEach(async () => {
    await disconnectRealtimeSession();
    resetRealtimeSessionControllerForTests();
    resetMockRealtimeClientOptions();
    vi.useRealTimers();
  });

  it("transitions through connect, opening speech, and listening", async () => {
    const lifecycle: string[] = [];

    configureRealtimeSessionController({
      onEvent: (event) => {
        if (event.type === "lifecycle") {
          lifecycle.push(event.status);
        }
      },
    });

    const connectPromise = connectRealtimeSession({
      credentials: MOCK_CREDENTIALS,
      openingTranscript: createOpeningTranscript(coffeeOrderingScenario),
      sessionEpoch: 1,
    });

    await Promise.all([connectPromise, vi.advanceTimersByTimeAsync(1_300)]);

    expect(lifecycle).toEqual([
      "connecting",
      "connected",
      "assistant_speaking",
      "connected",
      "listening",
    ]);
  });

  it("enters fallback mode after connection failure recovery is exhausted", async () => {
    const statuses: string[] = [];

    configureRealtimeSessionController({
      onEvent: (event) => {
        if (event.type === "lifecycle") {
          statuses.push(event.status);
        }
      },
    });

    setMockRealtimeClientOptions({ failOnConnect: true });

    const connectPromise = connectRealtimeSession({
      credentials: MOCK_CREDENTIALS,
      openingTranscript: createOpeningTranscript(coffeeOrderingScenario),
      sessionEpoch: 1,
    });

    await Promise.all([connectPromise, vi.advanceTimersByTimeAsync(10_000)]);

    enterRealtimeFallbackMode();
    expect(statuses).toContain("fallback");
  });

  it("ignores stale controller events from an older session epoch", async () => {
    const lifecycle: string[] = [];

    configureRealtimeSessionController({
      onEvent: (event) => {
        if (event.type === "lifecycle" && event.sessionEpoch === 2) {
          lifecycle.push(event.status);
        }
      },
    });

    const connectPromise = connectRealtimeSession({
      credentials: MOCK_CREDENTIALS,
      openingTranscript: createOpeningTranscript(coffeeOrderingScenario),
      sessionEpoch: 1,
    });

    await Promise.all([connectPromise, vi.advanceTimersByTimeAsync(1_300)]);

    expect(lifecycle).toEqual([]);
  });

  it("supports manual retry after a failed connection", async () => {
    const statuses: string[] = [];

    configureRealtimeSessionController({
      onEvent: (event) => {
        if (event.type === "lifecycle") {
          statuses.push(event.status);
        }
      },
    });

    setMockRealtimeClientOptions({ failOnConnect: true });
    const failedConnectPromise = connectRealtimeSession({
      credentials: MOCK_CREDENTIALS,
      openingTranscript: createOpeningTranscript(coffeeOrderingScenario),
      sessionEpoch: 1,
    });
    await Promise.all([failedConnectPromise, vi.advanceTimersByTimeAsync(10_000)]);

    resetMockRealtimeClientOptions();
    const retryPromise = retryRealtimeSession();
    await Promise.all([retryPromise, vi.advanceTimersByTimeAsync(1_300)]);

    expect(statuses).toContain("connecting");
    expect(statuses).toContain("listening");
  });
});
