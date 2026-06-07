import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { useConversationStore } from "@/features/conversation";

import { ScenarioPicker } from "@/components/scenario-picker";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("ScenarioPicker", () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    useConversationStore.getState().reset();
  });

  it("renders seed scenarios and navigates on selection", async () => {
    const user = userEvent.setup();

    render(<ScenarioPicker scenarios={[coffeeOrderingScenario]} />);

    expect(screen.getByTestId("scenario-grid")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-card-create")).toBeInTheDocument();
    expect(screen.getByText("在咖啡馆点咖啡")).toBeInTheDocument();

    await user.click(screen.getByTestId("scenario-card-coffee_ordering_a2"));

    expect(useConversationStore.getState().selectedScenario?.id).toBe("coffee_ordering_a2");
    expect(pushMock).toHaveBeenCalledWith("/practice/coffee_ordering_a2");
  });

  it("navigates to the create scenario page", async () => {
    const user = userEvent.setup();

    render(<ScenarioPicker scenarios={[coffeeOrderingScenario]} />);

    await user.click(screen.getByTestId("scenario-card-create"));

    expect(pushMock).toHaveBeenCalledWith("/scenarios/new");
  });
});
