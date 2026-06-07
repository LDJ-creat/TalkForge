import { describe, expect, it } from "vitest";

import { coffeeOrderingScenario } from "@/server/db/seeds/scenarios";
import {
  areRequiredGoalsComplete,
  buildScenarioProgressUpdate,
  countUserTurns,
  createInitialScenarioProgress,
  evaluateExitPolicy,
  getSessionDurationSec,
  isMaxDurationReached,
  isMaxTurnsReached,
  resolveMissingGoalIds,
} from "@/domain/scenario-ending";
import type { Turn } from "@/domain/turn";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

function createUserTurn(index: number): Turn {
  return {
    id: `turn-${index}`,
    sessionId: SESSION_ID,
    role: "user",
    startedAt: "2026-06-06T00:00:00.000Z",
    endedAt: "2026-06-06T00:00:10.000Z",
    evaluationStatus: "pending",
  };
}

describe("scenario exit policy rules", () => {
  it("creates initial progress with all required goals missing", () => {
    const progress = createInitialScenarioProgress(SESSION_ID, coffeeOrderingScenario);

    expect(progress.completedGoalIds).toEqual([]);
    expect(progress.missingGoalIds).toEqual(
      coffeeOrderingScenario.exitPolicy.requiredGoals,
    );
    expect(progress.shouldSuggestEnding).toBe(false);
  });

  it("detects max turns boundary", () => {
    expect(
      isMaxTurnsReached(coffeeOrderingScenario.exitPolicy, coffeeOrderingScenario.exitPolicy.maxTurns),
    ).toBe(true);
    expect(evaluateExitPolicy({
      exitPolicy: coffeeOrderingScenario.exitPolicy,
      completedGoalIds: [],
      userTurnCount: coffeeOrderingScenario.exitPolicy.maxTurns,
      durationSec: 10,
    })).toMatchObject({
      shouldSuggestEnding: true,
      endingSuggestionReason: "max_turns_reached",
    });
  });

  it("detects max duration boundary", () => {
    expect(
      isMaxDurationReached(
        coffeeOrderingScenario.exitPolicy,
        coffeeOrderingScenario.exitPolicy.maxDurationSec,
      ),
    ).toBe(true);
    expect(evaluateExitPolicy({
      exitPolicy: coffeeOrderingScenario.exitPolicy,
      completedGoalIds: [],
      userTurnCount: 1,
      durationSec: coffeeOrderingScenario.exitPolicy.maxDurationSec,
    })).toMatchObject({
      shouldSuggestEnding: true,
      endingSuggestionReason: "max_duration_reached",
    });
  });

  it("suggests ending when required goals complete and policy allows AI suggestion", () => {
    const completedGoalIds = coffeeOrderingScenario.exitPolicy.requiredGoals;

    expect(areRequiredGoalsComplete(coffeeOrderingScenario.exitPolicy, completedGoalIds)).toBe(
      true,
    );
    expect(evaluateExitPolicy({
      exitPolicy: coffeeOrderingScenario.exitPolicy,
      completedGoalIds,
      userTurnCount: 4,
      durationSec: 120,
    })).toMatchObject({
      shouldSuggestEnding: true,
      endingSuggestionReason: "required_goals_complete",
    });
  });

  it("does not suggest ending on goal completion when aiCanSuggestEnd is disabled", () => {
    const exitPolicy = {
      ...coffeeOrderingScenario.exitPolicy,
      aiCanSuggestEnd: false,
    };

    expect(evaluateExitPolicy({
      exitPolicy,
      completedGoalIds: exitPolicy.requiredGoals,
      userTurnCount: 4,
      durationSec: 120,
    })).toMatchObject({
      shouldSuggestEnding: false,
      endingSuggestionReason: null,
    });
  });

  it("builds progress updates without forcing session completion", () => {
    const turns = Array.from({ length: 4 }, (_, index) => createUserTurn(index));
    const progress = buildScenarioProgressUpdate({
      sessionId: SESSION_ID,
      scenario: coffeeOrderingScenario,
      session: {
        startedAt: "2026-06-06T00:00:00.000Z",
      },
      turns,
      completedGoalIds: coffeeOrderingScenario.exitPolicy.requiredGoals,
      offTopic: false,
    });

    expect(progress.shouldSuggestEnding).toBe(true);
    expect(progress.missingGoalIds).toEqual([]);
    expect(resolveMissingGoalIds(coffeeOrderingScenario, progress.completedGoalIds)).toEqual([]);
    expect(countUserTurns(turns)).toBe(4);
    expect(getSessionDurationSec({ startedAt: "2026-06-06T00:00:00.000Z" }, new Date("2026-06-06T00:02:00.000Z"))).toBe(120);
  });
  it("prefers judge current stage id when it is valid for the scenario", () => {
    const progress = buildScenarioProgressUpdate({
      sessionId: SESSION_ID,
      scenario: coffeeOrderingScenario,
      session: { startedAt: "2026-06-06T00:00:00.000Z" },
      turns: [createUserTurn(0)],
      completedGoalIds: ["choose_drink"],
      judgeCurrentStageId: "confirmation",
      offTopic: false,
    });

    expect(progress.currentStageId).toBe("confirmation");
  });

  it("merges previous completed goals into progress updates", () => {
    const progress = buildScenarioProgressUpdate({
      sessionId: SESSION_ID,
      scenario: coffeeOrderingScenario,
      session: { startedAt: "2026-06-06T00:00:00.000Z" },
      turns: [createUserTurn(0)],
      previousCompletedGoalIds: ["choose_drink", "choose_size"],
      completedGoalIds: ["customize_order"],
      offTopic: false,
    });

    expect(progress.completedGoalIds).toEqual(
      expect.arrayContaining(["choose_drink", "choose_size", "customize_order"]),
    );
  });
});

describe("shouldSuggestEnding integration", () => {
  it("prioritizes protective boundaries over goal completion messaging", () => {
    const evaluation = evaluateExitPolicy({
      exitPolicy: coffeeOrderingScenario.exitPolicy,
      completedGoalIds: coffeeOrderingScenario.exitPolicy.requiredGoals,
      userTurnCount: coffeeOrderingScenario.exitPolicy.maxTurns,
      durationSec: coffeeOrderingScenario.exitPolicy.maxDurationSec,
    });

    expect(evaluation.shouldSuggestEnding).toBe(true);
    expect(evaluation.endingSuggestionReason).toBe("max_turns_reached");
  });
});
