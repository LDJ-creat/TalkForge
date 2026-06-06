import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { isUuid } from "@/queue/ids";

import {
  getConversationInitialState,
  resetMockRealtimeSessionOptions,
  setMockRealtimeSessionOptions,
  useConversationStore,
} from "@/features/conversation";

describe("conversation store", () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
    resetMockRealtimeSessionOptions();
    vi.useRealTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in idle state", () => {
    expect(useConversationStore.getState()).toMatchObject(getConversationInitialState());
  });

  it("selects a scenario without starting a session", () => {
    useConversationStore.getState().selectScenario(coffeeOrderingScenario);

    const state = useConversationStore.getState();
    expect(state.selectedScenario?.id).toBe("coffee_ordering_a2");
    expect(state.session).toBeNull();
    expect(state.connectionStatus).toBe("idle");
  });

  it("transitions through connect and opening transcript on startSession", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);

    expect(useConversationStore.getState().connectionStatus).toBe("connecting");
    expect(useConversationStore.getState().session?.status).toBe("active");

    await vi.advanceTimersByTimeAsync(500);
    await startPromise;

    const state = useConversationStore.getState();
    expect(state.connectionStatus).toBe("connected");
    expect(state.realtimeCredentials?.provider).toBe("mock-realtime");
    expect(state.realtimeCredentials?.providerSessionId).toMatch(/^rt_coffee_ordering_a2_/);
    expect(state.realtimeCredentials?.connectionMode).toBe("websocket");
    expect(state.realtimeCredentials?.endpointUrl).toContain("mock.talkforge.local");
    expect(state.session?.realtimeProvider).toBe("mock-realtime");
    expect(state.session?.id).toBeTypeOf("string");
    expect(isUuid(state.session!.id)).toBe(true);
    expect(state.transcripts).toHaveLength(1);
    expect(state.transcripts[0]?.role).toBe("assistant");
    expect(state.turnStatus).toBe("idle");
  });

  it("completes a manual end session flow", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(500);
    await startPromise;

    const endPromise = useConversationStore.getState().requestEndSession();
    expect(useConversationStore.getState().endingState).toBe("user_requested");
    expect(useConversationStore.getState().connectionStatus).toBe("disconnecting");

    await vi.advanceTimersByTimeAsync(300);
    await endPromise;

    const state = useConversationStore.getState();
    expect(state.session?.status).toBe("completed");
    expect(state.session?.endedAt).toBeTypeOf("string");
    expect(state.connectionStatus).toBe("disconnected");
    expect(state.endingState).toBe("completed");
    expect(state.realtimeCredentials).toBeNull();
  });

  it("does not revive a session when end is requested during connect", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);

    expect(useConversationStore.getState().connectionStatus).toBe("connecting");

    const endPromise = useConversationStore.getState().requestEndSession();
    await vi.advanceTimersByTimeAsync(500);
    await startPromise;
    await vi.advanceTimersByTimeAsync(300);
    await endPromise;

    const state = useConversationStore.getState();
    expect(state.connectionStatus).toBe("disconnected");
    expect(state.session?.status).toBe("completed");
    expect(state.endingState).toBe("completed");
    expect(state.realtimeCredentials).toBeNull();
    expect(state.transcripts).toHaveLength(0);
  });

  it("allows manual end after an AI ending suggestion", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(500);
    await startPromise;

    useConversationStore.setState({
      transcripts: [
        ...useConversationStore.getState().transcripts,
        {
          id: "user-turn-1",
          role: "user",
          text: "Could I get a medium latte with oat milk? Yes, that's correct.",
          status: "final",
          timestamp: new Date().toISOString(),
        },
      ],
    });
    useConversationStore.getState().refreshScenarioProgress();

    expect(useConversationStore.getState().endingState).toBe("ai_suggested");
    expect(useConversationStore.getState().scenarioProgress?.shouldSuggestEnding).toBe(true);

    const endPromise = useConversationStore.getState().requestEndSession();
    expect(useConversationStore.getState().endingState).toBe("user_requested");

    await vi.advanceTimersByTimeAsync(300);
    await endPromise;

    expect(useConversationStore.getState().endingState).toBe("completed");
    expect(useConversationStore.getState().session?.status).toBe("completed");

    vi.unstubAllGlobals();
  });

  it("does not start duplicate sessions for the same active scenario", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(500);
    await startPromise;

    const firstSessionId = useConversationStore.getState().session?.id;

    await useConversationStore.getState().startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(500);

    expect(useConversationStore.getState().session?.id).toBe(firstSessionId);
  });

  it("sets error state when mock start fails", async () => {
    vi.useFakeTimers();
    setMockRealtimeSessionOptions({ failOnStart: true });

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);

    await vi.advanceTimersByTimeAsync(500);
    await startPromise;

    const state = useConversationStore.getState();
    expect(state.connectionStatus).toBe("error");
    expect(state.session?.status).toBe("failed");
    expect(state.errorMessage).toContain("Could not start");
    expect(state.realtimeCredentials).toBeNull();
  });

  it("sets error state when mock stop fails", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(500);
    await startPromise;

    setMockRealtimeSessionOptions({ failOnStop: true });

    const endPromise = useConversationStore.getState().requestEndSession();
    await vi.advanceTimersByTimeAsync(300);
    await endPromise;

    const state = useConversationStore.getState();
    expect(state.connectionStatus).toBe("error");
    expect(state.errorMessage).toContain("Could not end the session");
    expect(state.session?.status).toBe("active");
  });

  it("teardownSession stops an active mock session and clears state", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(500);
    await startPromise;

    const teardownPromise = useConversationStore.getState().teardownSession();
    await vi.advanceTimersByTimeAsync(300);
    await teardownPromise;

    expect(useConversationStore.getState()).toMatchObject(getConversationInitialState());
  });

  it("resets all conversation state", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(500);
    await startPromise;
    useConversationStore.getState().reset();

    expect(useConversationStore.getState()).toMatchObject(getConversationInitialState());
  });
});
