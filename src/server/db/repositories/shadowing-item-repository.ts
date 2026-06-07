import { asc, eq } from "drizzle-orm";

import {
  createShadowingItemId,
  type ShadowingItem,
  type ShadowingStandardAudio,
  type ShadowingStandardAudioStatus,
} from "@/domain/shadowing";

import type { TalkForgeDatabase } from "../client";
import { toShadowingItem } from "../mappers";
import { sessions, shadowingItems } from "../schema";

export type CreateShadowingItemRecordInput = {
  sessionId: string;
  standardText: string;
  originalText?: string;
  reason?: string;
  source: ShadowingItem["source"];
  turnId?: string;
  sortOrder: number;
  standardAudio?: ShadowingStandardAudio;
  standardAudioStatus: ShadowingStandardAudioStatus;
};

export async function listShadowingItemsBySessionId(
  db: TalkForgeDatabase,
  sessionId: string,
): Promise<ShadowingItem[]> {
  const rows = await db
    .select()
    .from(shadowingItems)
    .where(eq(shadowingItems.sessionId, sessionId))
    .orderBy(asc(shadowingItems.sortOrder));

  return rows.map(toShadowingItem);
}

export type ReplaceShadowingItemsForSessionInput = {
  sessionId: string;
  items: CreateShadowingItemRecordInput[];
};

export async function replaceShadowingItemsForSession(
  db: TalkForgeDatabase,
  input: ReplaceShadowingItemsForSessionInput,
): Promise<ShadowingItem[]> {
  return db.transaction(async (tx) => {
    await tx
      .delete(shadowingItems)
      .where(eq(shadowingItems.sessionId, input.sessionId));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await tx
      .insert(shadowingItems)
      .values(
        input.items.map((item) => ({
          id: createShadowingItemId(item.standardText, item.sortOrder, item.source),
          sessionId: item.sessionId,
          standardText: item.standardText,
          originalText: item.originalText,
          reason: item.reason,
          source: item.source,
          turnId: item.turnId,
          sortOrder: item.sortOrder,
          standardAudio: item.standardAudio,
          standardAudioStatus: item.standardAudioStatus,
        })),
      )
      .returning();

    return rows.map(toShadowingItem);
  });
}

export type PrepareShadowingGenerationResult =
  | { status: "complete"; items: ShadowingItem[] }
  | { status: "claimed" };

export async function prepareShadowingGeneration(
  db: TalkForgeDatabase,
  sessionId: string,
): Promise<PrepareShadowingGenerationResult> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .for("update");

    const existing = await tx
      .select()
      .from(shadowingItems)
      .where(eq(shadowingItems.sessionId, sessionId))
      .orderBy(asc(shadowingItems.sortOrder));

    if (existing.length > 0) {
      const generationComplete = existing.every(
        (row) =>
          row.standardAudioStatus === "ready" || row.standardAudioStatus === "failed",
      );

      if (generationComplete) {
        return {
          status: "complete",
          items: existing.map(toShadowingItem),
        };
      }

      await tx
        .delete(shadowingItems)
        .where(eq(shadowingItems.sessionId, sessionId));
    }

    return { status: "claimed" };
  });
}

export async function updateShadowingItemStandardAudio(
  db: TalkForgeDatabase,
  itemId: string,
  input: {
    standardAudio?: ShadowingStandardAudio;
    standardAudioStatus: ShadowingStandardAudioStatus;
  },
): Promise<ShadowingItem | null> {
  const [row] = await db
    .update(shadowingItems)
    .set({
      standardAudio: input.standardAudio,
      standardAudioStatus: input.standardAudioStatus,
    })
    .where(eq(shadowingItems.id, itemId))
    .returning();

  return row ? toShadowingItem(row) : null;
}
