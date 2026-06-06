import { eq } from "drizzle-orm";

import type { CreateTurnInput } from "@/domain/turn";

import type { TalkForgeDatabase } from "../client";
import { toTurn } from "../mappers";
import { turns } from "../schema";

export async function createTurn(db: TalkForgeDatabase, input: CreateTurnInput) {
  const [row] = await db
    .insert(turns)
    .values({
      sessionId: input.sessionId,
      role: input.role,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      transcriptText: input.transcriptText,
      audioSegmentId: input.audioSegmentId,
      evaluationStatus: input.evaluationStatus ?? "none",
    })
    .returning();

  return toTurn(row);
}

export async function getTurnById(db: TalkForgeDatabase, turnId: string) {
  const [row] = await db.select().from(turns).where(eq(turns.id, turnId)).limit(1);
  return row ? toTurn(row) : null;
}

export async function linkTurnAudioSegment(
  db: TalkForgeDatabase,
  turnId: string,
  audioSegmentId: string,
) {
  const [row] = await db
    .update(turns)
    .set({ audioSegmentId })
    .where(eq(turns.id, turnId))
    .returning();

  return row ? toTurn(row) : null;
}

export async function clearTurnAudioSegment(db: TalkForgeDatabase, turnId: string) {
  const [row] = await db
    .update(turns)
    .set({ audioSegmentId: null })
    .where(eq(turns.id, turnId))
    .returning();

  return row ? toTurn(row) : null;
}

export async function updateTurnTranscriptText(
  db: TalkForgeDatabase,
  turnId: string,
  transcriptText: string,
) {
  const [row] = await db
    .update(turns)
    .set({ transcriptText })
    .where(eq(turns.id, turnId))
    .returning();

  return row ? toTurn(row) : null;
}
