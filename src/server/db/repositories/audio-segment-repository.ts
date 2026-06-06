import { eq } from "drizzle-orm";

import type { CreateAudioSegmentInput } from "@/domain/audio-segment";

import type { TalkForgeDatabase } from "../client";
import { toAudioSegment } from "../mappers";
import { audioSegments } from "../schema";

export async function createAudioSegment(
  db: TalkForgeDatabase,
  input: CreateAudioSegmentInput,
) {
  const [row] = await db
    .insert(audioSegments)
    .values({
      turnId: input.turnId,
      objectKey: input.objectKey,
      format: input.format,
      codec: input.codec,
      sampleRate: input.sampleRate,
      durationMs: input.durationMs,
      sizeBytes: input.sizeBytes,
    })
    .returning();

  return toAudioSegment(row);
}

export async function getAudioSegmentById(db: TalkForgeDatabase, audioSegmentId: string) {
  const [row] = await db
    .select()
    .from(audioSegments)
    .where(eq(audioSegments.id, audioSegmentId))
    .limit(1);

  return row ? toAudioSegment(row) : null;
}

export async function getAudioSegmentByTurnId(db: TalkForgeDatabase, turnId: string) {
  const [row] = await db
    .select()
    .from(audioSegments)
    .where(eq(audioSegments.turnId, turnId))
    .limit(1);

  return row ? toAudioSegment(row) : null;
}

export async function deleteAudioSegment(db: TalkForgeDatabase, audioSegmentId: string) {
  await db.delete(audioSegments).where(eq(audioSegments.id, audioSegmentId));
}
