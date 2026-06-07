import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { DEV_USER_ID } from "@/shared/dev-user";
import {
  resetMockRealtimeClientOptions,
  resetRealtimeSessionControllerForTests,
  setMockRealtimeClientOptions,
  useConversationStore,
} from "@/features/conversation";

import { ConversationShell } from "@/components/conversation-shell";

describe("ConversationShell realtime lifecycle", () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
    resetMockRealtimeClientOptions();
    resetRealtimeSessionControllerForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    process.env.NEXT_PUBLIC_DEV_USER_ID = DEV_USER_ID;
  });

  afterEach(async () => {
    cleanup();
    await useConversationStore.getState().teardownSession();
    resetRealtimeSessionControllerForTests();
    vi.unstubAllGlobals();
  });

  it("shows retry and fallback actions when realtime connection fails", async () => {
    vi.useFakeTimers();
    setMockRealtimeClientOptions({ failOnConnect: true });

    render(<ConversationShell scenario={coffeeOrderingScenario} />);

    await Promise.all([
      vi.advanceTimersByTimeAsync(10_000),
      vi.runOnlyPendingTimersAsync(),
    ]);

    expect(screen.getByTestId("retry-realtime-button")).toBeInTheDocument();
    expect(screen.getByTestId("fallback-practice-button")).toBeInTheDocument();
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
    expect(screen.getByTestId("end-practice-button")).not.toBeDisabled();

    vi.useRealTimers();
  });

  it("enters fallback mode and exposes the practice button", async () => {
    vi.useFakeTimers();
    setMockRealtimeClientOptions({ failOnConnect: true });

    render(<ConversationShell scenario={coffeeOrderingScenario} />);
    await Promise.all([
      vi.advanceTimersByTimeAsync(10_000),
      vi.runOnlyPendingTimersAsync(),
    ]);

    fireEvent.click(screen.getByTestId("fallback-practice-button"));

    expect(useConversationStore.getState().realtimeLifecycleStatus).toBe("fallback");
    expect(screen.getByText("Text mode")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
