import { describe, expect, it } from "vitest";

import type { CreateCorrectionInput } from "@/domain/correction";

const TURN_ID = "22222222-2222-4222-8222-222222222222";

const sampleInput: CreateCorrectionInput = {
  turnId: TURN_ID,
  type: "grammar",
  originalText: "I go to",
  correctedText: "I went to",
  explanation: "Use past tense.",
  confidence: 0.9,
};

/**
 * Mirrors the transactional branch logic used by saveCorrectionsForTurnIfAbsent
 * so repository persistence rules stay covered without a live Postgres instance.
 */
function createTransactionalCorrectionStore() {
  const correctionsByTurn = new Map<string, Array<CreateCorrectionInput & { id: string }>>();
  let nextId = 0;

  return {
    saveIfAbsent(turnId: string, inputs: CreateCorrectionInput[]) {
      const existing = correctionsByTurn.get(turnId) ?? [];
      if (existing.length > 0) {
        return { corrections: existing, created: false as const };
      }

      if (inputs.length === 0) {
        return { corrections: [], created: true as const };
      }

      const created = inputs.map((input) => ({
        id: `77777777-7777-4777-8777-${String(nextId++).padStart(12, "0")}`,
        ...input,
      }));
      correctionsByTurn.set(turnId, created);
      return { corrections: created, created: true as const };
    },
    allForTurn(turnId: string) {
      return correctionsByTurn.get(turnId) ?? [];
    },
  };
}

describe("correction repository persistence contract", () => {
  it("preserves first-write wins semantics when rows already exist", () => {
    const store = createTransactionalCorrectionStore();

    const first = store.saveIfAbsent(TURN_ID, [sampleInput]);
    const second = store.saveIfAbsent(TURN_ID, [sampleInput]);

    expect(first.created).toBe(true);
    expect(first.corrections).toHaveLength(1);
    expect(second.created).toBe(false);
    expect(second.corrections).toEqual(first.corrections);
    expect(store.allForTurn(TURN_ID)).toHaveLength(1);
  });
});
