import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { DEV_USER_ID } from "@/shared/dev-user";
import {
  resetMockRealtimeClientOptions,
  resetRealtimeSessionControllerForTests,
  useConversationStore,
} from "@/features/conversation";

import { ConversationShell } from "@/components/conversation-shell";

const BACKEND_SESSION_ID = "11111111-1111-4111-8111-111111111111";

function createFetchMock(options?: { backendLinked?: boolean }) {
  const backendLinked = options?.backendLinked ?? false;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (backendLinked && url.endsWith("/api/sessions") && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          session: {
            id: BACKEND_SESSION_ID,
            scenarioId: coffeeOrderingScenario.id,
            status: "active",
            startedAt: "2026-06-06T00:00:00.000Z",
            realtimeProvider: "mock-realtime",
            backendLinked: true,
          },
          realtimeCredentials: {
            provider: "mock-realtime",
            providerSessionId: "rt_session_test",
            token: "rt_token_test",
            expiresAt: "2026-06-06T01:00:00.000Z",
            connectionMode: "websocket",
            endpointUrl: "wss://mock.talkforge.local/realtime",
          },
        }),
        { status: 200 },
      );
    }

    if (backendLinked && url.includes("/progress")) {
      return new Response(JSON.stringify({ progress: null }), { status: 404 });
    }

    return new Response(null, { status: 404 });
  });
}

describe("ConversationShell", () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
    resetMockRealtimeClientOptions();
    resetRealtimeSessionControllerForTests();
    vi.useRealTimers();
    vi.stubGlobal("fetch", createFetchMock());
    process.env.NEXT_PUBLIC_DEV_USER_ID = DEV_USER_ID;
  });

  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    await useConversationStore.getState().teardownSession();
    vi.unstubAllGlobals();
  });

  it("starts a mock session and allows manual end", async () => {
    vi.useFakeTimers();

    render(<ConversationShell scenario={coffeeOrderingScenario} />);

    expect(screen.getAllByTestId("conversation-shell")[0]).toBeInTheDocument();
    expect(screen.getByText("Connecting…")).toBeInTheDocument();

    await Promise.all([
      vi.advanceTimersByTimeAsync(1_300),
      vi.runOnlyPendingTimersAsync(),
    ]);

    expect(screen.getByText("Listening")).toBeInTheDocument();
    expect(screen.getByTestId("transcript-entry-assistant")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-practice-turn-button")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId("end-practice-button")[0]!);
    expect(screen.getByText("Ending session…")).toBeInTheDocument();

    await Promise.all([
      vi.advanceTimersByTimeAsync(300),
      vi.runOnlyPendingTimersAsync(),
    ]);

    expect(screen.getByTestId("session-ended-banner")).toBeInTheDocument();
    expect(useConversationStore.getState().session?.status).toBe("completed");

    vi.useRealTimers();
  });

  it("shows an interrupt control while the assistant is speaking", async () => {
    vi.useFakeTimers();

    render(<ConversationShell scenario={coffeeOrderingScenario} />);

    await Promise.all([
      vi.advanceTimersByTimeAsync(500),
      vi.runOnlyPendingTimersAsync(),
    ]);

    expect(screen.getByTestId("interrupt-assistant-button")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("shows the practice button only in fallback mode for backend-linked sessions", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", createFetchMock({ backendLinked: true }));

    render(<ConversationShell scenario={coffeeOrderingScenario} />);

    await Promise.all([
      vi.advanceTimersByTimeAsync(1_300),
      vi.runOnlyPendingTimersAsync(),
    ]);

    expect(screen.queryByTestId("mock-practice-turn-button")).not.toBeInTheDocument();

    await act(async () => {
      useConversationStore.getState().enterRealtimeFallback();
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByTestId("mock-practice-turn-button")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
