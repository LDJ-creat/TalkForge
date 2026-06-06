import { beforeEach, describe, expect, it, vi } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import { DEV_USER_ID } from "@/shared/dev-user";

const ensureUserExists = vi.fn();
const getScenarioById = vi.fn();
const upsertScenario = vi.fn();

vi.mock("@/server/db/repositories/user-repository", () => ({
  ensureUserExists: (...args: unknown[]) => ensureUserExists(...args),
}));

vi.mock("@/server/db/repositories/scenario-session-repository", () => ({
  getScenarioById: (...args: unknown[]) => getScenarioById(...args),
  upsertScenario: (...args: unknown[]) => upsertScenario(...args),
}));

import { ensureDevSessionPrerequisites } from "@/server/db/seeds/ensure-dev-session-prerequisites";

describe("ensureDevSessionPrerequisites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureUserExists.mockResolvedValue({ id: DEV_USER_ID });
  });

  it("ensures the dev user exists and upserts missing seed scenarios", async () => {
    getScenarioById.mockResolvedValue(null);
    upsertScenario.mockResolvedValue(coffeeOrderingScenario);

    await ensureDevSessionPrerequisites({} as never, DEV_USER_ID, coffeeOrderingScenario.id);

    expect(ensureUserExists).toHaveBeenCalledWith({}, DEV_USER_ID);
    expect(upsertScenario).toHaveBeenCalledWith({}, coffeeOrderingScenario);
  });

  it("skips scenario upsert when the scenario is already present", async () => {
    getScenarioById.mockResolvedValue(coffeeOrderingScenario);

    await ensureDevSessionPrerequisites({} as never, DEV_USER_ID, coffeeOrderingScenario.id);

    expect(upsertScenario).not.toHaveBeenCalled();
  });
});
