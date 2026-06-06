import { eq, inArray } from "drizzle-orm";

import type { CreateTranscriptInput } from "@/domain/transcript";

import type { TalkForgeDatabase } from "../client";
import { toTranscript } from "../mappers";
import { transcripts } from "../schema";
import { updateTurnTranscriptText } from "./turn-repository";

export async function createTranscript(
  db: TalkForgeDatabase,
  input: CreateTranscriptInput,
) {
  const [row] = await db
    .insert(transcripts)
    .values({
      turnId: input.turnId,
      provider: input.provider,
      text: input.text,
      confidence: input.confidence,
      segments: input.segments,
    })
    .returning();

  return toTranscript(row);
}

export async function getTranscriptById(db: TalkForgeDatabase, transcriptId: string) {
  const [row] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.id, transcriptId))
    .limit(1);

  return row ? toTranscript(row) : null;
}

export async function getTranscriptByTurnId(db: TalkForgeDatabase, turnId: string) {
  const [row] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.turnId, turnId))
    .limit(1);

  return row ? toTranscript(row) : null;
}

export async function getTranscriptsByTurnIds(
  db: TalkForgeDatabase,
  turnIds: string[],
) {
  if (turnIds.length === 0) {
    return new Map<string, ReturnType<typeof toTranscript>>();
  }

  const rows = await db
    .select()
    .from(transcripts)
    .where(inArray(transcripts.turnId, turnIds));

  return new Map(rows.map((row) => [row.turnId, toTranscript(row)] as const));
}

export type SaveTranscriptForTurnResult = {
  transcript: ReturnType<typeof toTranscript>;
  created: boolean;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export async function saveTranscriptForTurn(
  db: TalkForgeDatabase,
  input: CreateTranscriptInput,
): Promise<SaveTranscriptForTurnResult> {
  return db.transaction(async (tx) => {
    const existing = await getTranscriptByTurnId(tx, input.turnId);
    if (existing) {
      return { transcript: existing, created: false };
    }

    try {
      const transcript = await createTranscript(tx, input);
      await updateTurnTranscriptText(tx, input.turnId, input.text);
      return { transcript, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await getTranscriptByTurnId(tx, input.turnId);
        if (raced) {
          return { transcript: raced, created: false };
        }
      }

      throw error;
    }
  });
}
