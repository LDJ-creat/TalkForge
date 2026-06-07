import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { isUuid } from "@/queue/ids";

import {
  getConversationInitialState,
  resetMockRealtimeClientOptions,
  resetMockRealtimeSessionOptions,
  resetRealtimeSessionControllerForTests,
  setMockRealtimeClientOptions,
  setMockRealtimeSessionOptions,
  useConversationStore,
} from "@/features/conversation";

describe("conversation store", () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
    resetMockRealtimeSessionOptions();
    resetMockRealtimeClientOptions();
    resetRealtimeSessionControllerForTests();
    vi.useRealTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
  });

  afterEach(async () => {
    vi.useRealTimers();
    await useConversationStore.getState().teardownSession();
    resetRealtimeSessionControllerForTests();
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

    await Promise.all([startPromise, vi.advanceTimersByTimeAsync(1_300)]);

    const state = useConversationStore.getState();
    expect(state.realtimeLifecycleStatus).toBe("listening");
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

    vi.useRealTimers();
  });

  it("completes a manual end session flow", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await Promise.all([startPromise, vi.advanceTimersByTimeAsync(1_300)]);

    const endPromise = useConversationStore.getState().requestEndSession();
    expect(useConversationStore.getState().endingState).toBe("user_requested");
    expect(useConversationStore.getState().connectionStatus).toBe("disconnecting");

    await Promise.all([endPromise, vi.advanceTimersByTimeAsync(300)]);

    const state = useConversationStore.getState();
    expect(state.session?.status).toBe("completed");
    expect(state.session?.endedAt).toBeTypeOf("string");
    expect(state.connectionStatus).toBe("disconnected");
    expect(state.endingState).toBe("completed");
    expect(state.realtimeCredentials).toBeNull();

    vi.useRealTimers();
  });

  it("does not revive a session when end is requested during connect", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);

    expect(useConversationStore.getState().connectionStatus).toBe("connecting");

    const endPromise = useConversationStore.getState().requestEndSession();
    await Promise.all([startPromise, endPromise, vi.advanceTimersByTimeAsync(1_700)]);

    const state = useConversationStore.getState();
    expect(state.connectionStatus).toBe("disconnected");
    expect(state.session?.status).toBe("completed");
    expect(state.endingState).toBe("completed");
    expect(state.realtimeCredentials).toBeNull();
    expect(state.transcripts).toHaveLength(0);

    vi.useRealTimers();
  });

  it("allows manual end after an AI ending suggestion", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await Promise.all([startPromise, vi.advanceTimersByTimeAsync(1_300)]);

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

    await Promise.all([endPromise, vi.advanceTimersByTimeAsync(300)]);

    expect(useConversationStore.getState().endingState).toBe("completed");
    expect(useConversationStore.getState().session?.status).toBe("completed");

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not start duplicate sessions for the same active scenario", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await Promise.all([startPromise, vi.advanceTimersByTimeAsync(1_300)]);

    const firstSessionId = useConversationStore.getState().session?.id;

    await useConversationStore.getState().startSession(coffeeOrderingScenario);
    await vi.advanceTimersByTimeAsync(1_700);

    expect(useConversationStore.getState().session?.id).toBe(firstSessionId);

    vi.useRealTimers();
  });

  it("interrupts assistant speech through the realtime controller", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);

    await vi.advanceTimersByTimeAsync(500);

    expect(useConversationStore.getState().realtimeLifecycleStatus).toBe(
      "assistant_speaking",
    );

    useConversationStore.getState().interruptRealtimeAssistant();

    await vi.advanceTimersByTimeAsync(800);
    await startPromise;

    expect(useConversationStore.getState().realtimeLifecycleStatus).toBe("listening");

    vi.useRealTimers();
  });

  it("ignores stale realtime controller events after the session epoch changes", () => {
    useConversationStore.setState({
      sessionEpoch: 2,
      realtimeLifecycleStatus: "listening",
      connectionStatus: "connected",
    });

    useConversationStore.getState().handleRealtimeControllerEvent({
      sessionEpoch: 1,
      type: "lifecycle",
      status: "failed",
    });

    expect(useConversationStore.getState().realtimeLifecycleStatus).toBe("listening");
  });

  it("sets error state when mock start fails", async () => {
    vi.useFakeTimers();
    setMockRealtimeSessionOptions({ failOnStart: true });

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);

    await startPromise;

    const state = useConversationStore.getState();
    expect(state.connectionStatus).toBe("failed");
    expect(state.realtimeLifecycleStatus).toBe("failed");
    expect(state.session?.status).toBe("failed");
    expect(state.errorMessage).toBeTruthy();
    expect(state.realtimeCredentials).toBeNull();

    vi.useRealTimers();
  });

  it("sets error state when mock stop fails", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await Promise.all([startPromise, vi.advanceTimersByTimeAsync(1_300)]);

    setMockRealtimeClientOptions({ failOnDisconnect: true });

    const endPromise = useConversationStore.getState().requestEndSession();
    await Promise.all([endPromise, vi.advanceTimersByTimeAsync(300)]);

    const state = useConversationStore.getState();
    expect(state.connectionStatus).toBe("error");
    expect(state.errorMessage).toContain("Could not end the session");
    expect(state.session?.status).toBe("active");

    vi.useRealTimers();
  });

  it("teardownSession stops an active mock session and clears state", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await Promise.all([startPromise, vi.advanceTimersByTimeAsync(1_300)]);

    const teardownPromise = useConversationStore.getState().teardownSession();
    await Promise.all([teardownPromise, vi.advanceTimersByTimeAsync(300)]);

    const state = useConversationStore.getState();
    const { sessionEpoch, ...clearedState } = state;
    const { sessionEpoch: _initialEpoch, ...initialState } =
      getConversationInitialState();
    expect(clearedState).toMatchObject(initialState);
    expect(sessionEpoch).toBe(2);

    vi.useRealTimers();
  });

  it("does not clear realtime errors when progress sync has no usage limit banner", async () => {
    useConversationStore.setState({
      session: {
        id: "session-1",
        scenarioId: coffeeOrderingScenario.id,
        status: "active",
        startedAt: new Date().toISOString(),
        backendLinked: true,
      },
      progressSource: "server",
      errorMessage: "Realtime connection failed. Retry or continue in text mode.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            progress: {
              sessionId: "session-1",
              currentStageId: "order",
              completedGoalIds: [],
              missingGoalIds: ["goal-1"],
              shouldSuggestEnding: false,
              offTopic: false,
              updatedAt: new Date().toISOString(),
              endingSuggestionReason: null,
              boundaries: {
                maxTurnsReached: false,
                maxDurationReached: false,
                userTurnCount: 1,
                durationSec: 10,
              },
              usageLimits: {
                maxTurns: 8,
                maxDurationSec: 600,
                maxAsrJobs: 50,
                maxReportAttempts: 5,
                userTurnCount: 1,
                durationSec: 10,
                asrJobsUsed: 0,
                reportAttemptsUsed: 0,
                turnLimitReached: false,
                durationLimitReached: false,
                asrLimitReached: false,
                reportLimitReached: false,
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await useConversationStore.getState().syncSessionProgressFromServer();

    expect(useConversationStore.getState().errorMessage).toBe(
      "Realtime connection failed. Retry or continue in text mode.",
    );

    vi.unstubAllGlobals();
  });

  it("resets all conversation state", async () => {
    vi.useFakeTimers();

    const startPromise = useConversationStore
      .getState()
      .startSession(coffeeOrderingScenario);
    await Promise.all([startPromise, vi.advanceTimersByTimeAsync(1_300)]);
    useConversationStore.getState().reset();

    expect(useConversationStore.getState()).toMatchObject(getConversationInitialState());

    vi.useRealTimers();
  });
});
