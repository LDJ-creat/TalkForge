import { describe, expect, it } from "vitest";

import {
  resolveJudgeCurrentStageId,
  shouldEnqueueScenarioProgressJudge,
} from "@/server/scenario-progress/enqueue-policy";

describe("scenario progress enqueue policy", () => {
  it("enqueues on every user turn when interval is 1", () => {
    expect(shouldEnqueueScenarioProgressJudge(1, 1)).toBe(true);
    expect(shouldEnqueueScenarioProgressJudge(3, 1)).toBe(true);
  });

  it("enqueues only on configured user-turn intervals", () => {
    expect(shouldEnqueueScenarioProgressJudge(1, 2)).toBe(false);
    expect(shouldEnqueueScenarioProgressJudge(2, 2)).toBe(true);
    expect(shouldEnqueueScenarioProgressJudge(3, 2)).toBe(false);
    expect(shouldEnqueueScenarioProgressJudge(4, 2)).toBe(true);
  });

  it("accepts only known stage ids from judge output", () => {
    expect(resolveJudgeCurrentStageId(["greeting", "closing"], "closing")).toBe(
      "closing",
    );
    expect(resolveJudgeCurrentStageId(["greeting"], "unknown")).toBeUndefined();
  });
});
