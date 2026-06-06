import { render, screen } from "@testing-library/react";
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
    pushMock.mockReset();
    useConversationStore.getState().reset();
  });

  it("renders seed scenarios and navigates on selection", async () => {
    const user = userEvent.setup();

    render(<ScenarioPicker scenarios={[coffeeOrderingScenario]} />);

    expect(screen.getByTestId("scenario-grid")).toBeInTheDocument();
    expect(screen.getByText("Order Coffee at a Cafe")).toBeInTheDocument();

    await user.click(screen.getByTestId("scenario-card-coffee_ordering_a2"));

    expect(useConversationStore.getState().selectedScenario?.id).toBe("coffee_ordering_a2");
    expect(pushMock).toHaveBeenCalledWith("/practice/coffee_ordering_a2");
  });
});
