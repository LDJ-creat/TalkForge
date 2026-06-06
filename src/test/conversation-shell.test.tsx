import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { useConversationStore } from "@/features/conversation";

import { ConversationShell } from "@/components/conversation-shell";

describe("ConversationShell", () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
    vi.useRealTimers();
  });

  afterEach(async () => {
    await useConversationStore.getState().teardownSession();
    vi.useRealTimers();
  });

  it("starts a mock session and allows manual end", async () => {
    vi.useFakeTimers();

    render(<ConversationShell scenario={coffeeOrderingScenario} />);

    expect(screen.getByTestId("conversation-shell")).toBeInTheDocument();
    expect(screen.getByText("Connecting…")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(500);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByTestId("transcript-entry-assistant")).toBeInTheDocument();

    const endButton = screen.getByTestId("end-practice-button");
    expect(endButton).not.toBeDisabled();

    fireEvent.click(endButton);
    expect(screen.getByText("Ending session…")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(300);

    expect(screen.getByTestId("session-ended-banner")).toBeInTheDocument();
    expect(useConversationStore.getState().session?.status).toBe("completed");

    vi.useRealTimers();
  });
});
