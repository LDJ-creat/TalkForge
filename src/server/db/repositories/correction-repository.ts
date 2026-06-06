import { eq, inArray } from "drizzle-orm";

import type { Correction, CreateCorrectionInput } from "@/domain/correction";

import type { TalkForgeDatabase } from "../client";
import { toCorrection } from "../mappers";
import { corrections, turns } from "../schema";

export async function createCorrection(
  db: TalkForgeDatabase,
  input: CreateCorrectionInput,
) {
  const [row] = await db
    .insert(corrections)
    .values({
      turnId: input.turnId,
      type: input.type,
      originalText: input.originalText,
      correctedText: input.correctedText,
      explanation: input.explanation,
      confidence: input.confidence,
    })
    .returning();

  return toCorrection(row);
}

export async function createCorrections(
  db: TalkForgeDatabase,
  inputs: CreateCorrectionInput[],
) {
  if (inputs.length === 0) {
    return [];
  }

  const rows = await db
    .insert(corrections)
    .values(
      inputs.map((input) => ({
        turnId: input.turnId,
        type: input.type,
        originalText: input.originalText,
        correctedText: input.correctedText,
        explanation: input.explanation,
        confidence: input.confidence,
      })),
    )
    .returning();

  return rows.map(toCorrection);
}

export async function getCorrectionsByTurnId(db: TalkForgeDatabase, turnId: string) {
  const rows = await db
    .select()
    .from(corrections)
    .where(eq(corrections.turnId, turnId));

  return rows.map(toCorrection);
}

export async function getCorrectionsByTurnIds(
  db: TalkForgeDatabase,
  turnIds: string[],
) {
  const result = new Map<string, Correction[]>();

  if (turnIds.length === 0) {
    return result;
  }

  const rows = await db
    .select()
    .from(corrections)
    .where(inArray(corrections.turnId, turnIds));

  for (const turnId of turnIds) {
    result.set(turnId, []);
  }

  for (const row of rows) {
    const correction = toCorrection(row);
    const existing = result.get(row.turnId) ?? [];
    existing.push(correction);
    result.set(row.turnId, existing);
  }

  return result;
}

export type SaveCorrectionsForTurnResult = {
  corrections: Correction[];
  created: boolean;
};

/** Persists corrections once per turn, serializing concurrent writers on the turn row. */
export async function saveCorrectionsForTurnIfAbsent(
  db: TalkForgeDatabase,
  turnId: string,
  inputs: CreateCorrectionInput[],
): Promise<SaveCorrectionsForTurnResult> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: turns.id })
      .from(turns)
      .where(eq(turns.id, turnId))
      .for("update");

    const existing = await getCorrectionsByTurnId(tx, turnId);
    if (existing.length > 0) {
      return { corrections: existing, created: false };
    }

    if (inputs.length === 0) {
      return { corrections: [], created: true };
    }

    const created = await createCorrections(tx, inputs);
    return { corrections: created, created: true };
  });
}

/** Reserved for re-analysis flows that replace prior correction rows. */
export async function deleteCorrectionsByTurnId(db: TalkForgeDatabase, turnId: string) {
  await db.delete(corrections).where(eq(corrections.turnId, turnId));
}
