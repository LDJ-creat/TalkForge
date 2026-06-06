import { describe, expect, it } from "vitest";

import type { CreatePronunciationEvaluationInput } from "@/domain/pronunciation-evaluation";

const TURN_ID = "22222222-2222-4222-8222-222222222222";

const freeSpeechInput: CreatePronunciationEvaluationInput = {
  turnId: TURN_ID,
  mode: "free_speech",
  overallScore: 76,
  fluencyScore: 78,
  details: { paceWpm: 118 },
};

const shadowingInput: CreatePronunciationEvaluationInput = {
  turnId: TURN_ID,
  mode: "shadowing",
  overallScore: 84,
  accuracyScore: 86,
  completenessScore: 88,
};

/**
 * Mirrors transactional first-write wins semantics without a live Postgres instance.
 */
function createTransactionalPronunciationStore() {
  const evaluationsByTurnMode = new Map<
    string,
    CreatePronunciationEvaluationInput & { id: string }
  >();
  const turnStatuses = new Map<string, string>();
  let nextId = 0;

  const key = (turnId: string, mode: string) => `${turnId}:${mode}`;

  return {
    prepareFreeSpeech(turnId: string) {
      const existing = evaluationsByTurnMode.get(key(turnId, "free_speech"));
      if (existing) {
        return { status: "exists" as const, evaluation: existing };
      }

      turnStatuses.set(turnId, "processing");
      return { status: "ready" as const };
    },
    saveFreeSpeechIfAbsent(input: CreatePronunciationEvaluationInput) {
      const existing = evaluationsByTurnMode.get(key(input.turnId, input.mode));
      if (existing) {
        turnStatuses.set(input.turnId, "done");
        return { evaluation: existing, created: false as const };
      }

      const created = {
        id: `88888888-8888-4888-8888-${String(nextId++).padStart(12, "0")}`,
        ...input,
      };
      evaluationsByTurnMode.set(key(input.turnId, input.mode), created);
      turnStatuses.set(input.turnId, "done");
      return { evaluation: created, created: true as const };
    },
    saveShadowingIfAbsent(input: CreatePronunciationEvaluationInput) {
      const existing = evaluationsByTurnMode.get(key(input.turnId, input.mode));
      if (existing) {
        return { evaluation: existing, created: false as const };
      }

      const created = {
        id: `99999999-9999-4999-8999-${String(nextId++).padStart(12, "0")}`,
        ...input,
      };
      evaluationsByTurnMode.set(key(input.turnId, input.mode), created);
      return { evaluation: created, created: true as const };
    },
    statusForTurn(turnId: string) {
      return turnStatuses.get(turnId);
    },
  };
}

describe("pronunciation evaluation repository persistence contract", () => {
  it("prepares free speech once and preserves first-write wins on save", () => {
    const store = createTransactionalPronunciationStore();

    const prepared = store.prepareFreeSpeech(TURN_ID);
    const first = store.saveFreeSpeechIfAbsent(freeSpeechInput);
    const second = store.saveFreeSpeechIfAbsent(freeSpeechInput);

    expect(prepared.status).toBe("ready");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.evaluation).toEqual(first.evaluation);
    expect(store.statusForTurn(TURN_ID)).toBe("done");
  });

  it("returns existing free speech evaluation without re-entering provider flow", () => {
    const store = createTransactionalPronunciationStore();
    store.saveFreeSpeechIfAbsent(freeSpeechInput);

    const prepared = store.prepareFreeSpeech(TURN_ID);

    expect(prepared.status).toBe("exists");
    if (prepared.status === "exists") {
      expect(prepared.evaluation.mode).toBe("free_speech");
    }
  });

  it("persists shadowing evaluations once per turn and mode", () => {
    const store = createTransactionalPronunciationStore();

    const first = store.saveShadowingIfAbsent(shadowingInput);
    const second = store.saveShadowingIfAbsent(shadowingInput);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.evaluation).toEqual(first.evaluation);
  });
});
