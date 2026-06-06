import { and, eq, inArray } from "drizzle-orm";

import type { PronunciationMode } from "@/domain/enums";
import type {
  CreatePronunciationEvaluationInput,
  PronunciationEvaluation,
} from "@/domain/pronunciation-evaluation";

import type { TalkForgeDatabase } from "../client";
import { isUniqueViolation } from "../repository-errors";
import { toPronunciationEvaluation } from "../mappers";
import { pronunciationEvaluations, turns } from "../schema";
import { updateTurnEvaluationStatus } from "./turn-repository";

export type SavePronunciationEvaluationResult = {
  evaluation: PronunciationEvaluation;
  created: boolean;
};

export type PrepareFreeSpeechEvaluationResult =
  | { status: "exists"; evaluation: PronunciationEvaluation }
  | { status: "ready" };

async function createPronunciationEvaluation(
  db: TalkForgeDatabase,
  input: CreatePronunciationEvaluationInput,
) {
  const [row] = await db
    .insert(pronunciationEvaluations)
    .values({
      turnId: input.turnId,
      mode: input.mode,
      overallScore: input.overallScore,
      fluencyScore: input.fluencyScore,
      accuracyScore: input.accuracyScore,
      completenessScore: input.completenessScore,
      prosodyScore: input.prosodyScore,
      details: input.details,
    })
    .returning();

  return toPronunciationEvaluation(row);
}

export async function getFreeSpeechEvaluationsByTurnIds(
  db: TalkForgeDatabase,
  turnIds: string[],
) {
  const result = new Map<string, PronunciationEvaluation>();

  if (turnIds.length === 0) {
    return result;
  }

  const rows = await db
    .select()
    .from(pronunciationEvaluations)
    .where(
      and(
        inArray(pronunciationEvaluations.turnId, turnIds),
        eq(pronunciationEvaluations.mode, "free_speech"),
      ),
    );

  for (const row of rows) {
    result.set(row.turnId, toPronunciationEvaluation(row));
  }

  return result;
}

export async function getPronunciationEvaluationByTurnIdAndMode(
  db: TalkForgeDatabase,
  turnId: string,
  mode: PronunciationMode,
) {
  const [row] = await db
    .select()
    .from(pronunciationEvaluations)
    .where(
      and(
        eq(pronunciationEvaluations.turnId, turnId),
        eq(pronunciationEvaluations.mode, mode),
      ),
    )
    .limit(1);

  return row ? toPronunciationEvaluation(row) : null;
}

/** Locks the turn row and marks evaluation as processing when no row exists yet. */
export async function prepareFreeSpeechEvaluation(
  db: TalkForgeDatabase,
  turnId: string,
): Promise<PrepareFreeSpeechEvaluationResult> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: turns.id })
      .from(turns)
      .where(eq(turns.id, turnId))
      .for("update");

    const existing = await getPronunciationEvaluationByTurnIdAndMode(
      tx,
      turnId,
      "free_speech",
    );
    if (existing) {
      return { status: "exists", evaluation: existing };
    }

    await updateTurnEvaluationStatus(tx, turnId, "processing");
    return { status: "ready" };
  });
}

export async function saveFreeSpeechEvaluationForTurnIfAbsent(
  db: TalkForgeDatabase,
  input: CreatePronunciationEvaluationInput,
): Promise<SavePronunciationEvaluationResult> {
  if (input.mode !== "free_speech") {
    throw new Error("saveFreeSpeechEvaluationForTurnIfAbsent requires free_speech mode.");
  }

  return db.transaction(async (tx) => {
    await tx
      .select({ id: turns.id })
      .from(turns)
      .where(eq(turns.id, input.turnId))
      .for("update");

    const existing = await getPronunciationEvaluationByTurnIdAndMode(
      tx,
      input.turnId,
      "free_speech",
    );
    if (existing) {
      await updateTurnEvaluationStatus(tx, input.turnId, "done");
      return { evaluation: existing, created: false };
    }

    try {
      const evaluation = await createPronunciationEvaluation(tx, input);
      await updateTurnEvaluationStatus(tx, input.turnId, "done");
      return { evaluation, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await getPronunciationEvaluationByTurnIdAndMode(
          tx,
          input.turnId,
          "free_speech",
        );
        if (raced) {
          await updateTurnEvaluationStatus(tx, input.turnId, "done");
          return { evaluation: raced, created: false };
        }
      }

      throw error;
    }
  });
}

export async function saveShadowingEvaluationForTurnIfAbsent(
  db: TalkForgeDatabase,
  input: CreatePronunciationEvaluationInput,
): Promise<SavePronunciationEvaluationResult> {
  if (input.mode !== "shadowing") {
    throw new Error("saveShadowingEvaluationForTurnIfAbsent requires shadowing mode.");
  }

  return db.transaction(async (tx) => {
    await tx
      .select({ id: turns.id })
      .from(turns)
      .where(eq(turns.id, input.turnId))
      .for("update");

    const existing = await getPronunciationEvaluationByTurnIdAndMode(
      tx,
      input.turnId,
      "shadowing",
    );
    if (existing) {
      return { evaluation: existing, created: false };
    }

    try {
      const evaluation = await createPronunciationEvaluation(tx, input);
      return { evaluation, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await getPronunciationEvaluationByTurnIdAndMode(
          tx,
          input.turnId,
          "shadowing",
        );
        if (raced) {
          return { evaluation: raced, created: false };
        }
      }

      throw error;
    }
  });
}

export async function markTurnEvaluationFailed(
  db: TalkForgeDatabase,
  turnId: string,
) {
  await updateTurnEvaluationStatus(db, turnId, "failed");
}
