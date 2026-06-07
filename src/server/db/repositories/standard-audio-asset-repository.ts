import { eq } from "drizzle-orm";

import type { StandardAudioAsset, UpsertStandardAudioAssetInput } from "@/domain/standard-audio-asset";
import type { StandardAudioMetadataRepository } from "@/providers/dashscope-cosyvoice";

import type { TalkForgeDatabase } from "../client";
import { toStandardAudioAsset } from "../mappers";
import { standardAudioAssets } from "../schema";

export async function findStandardAudioAssetByCacheKey(
  db: TalkForgeDatabase,
  cacheKey: string,
): Promise<StandardAudioAsset | null> {
  const [row] = await db
    .select()
    .from(standardAudioAssets)
    .where(eq(standardAudioAssets.cacheKey, cacheKey))
    .limit(1);

  return row ? toStandardAudioAsset(row) : null;
}

export async function upsertStandardAudioAsset(
  db: TalkForgeDatabase,
  input: UpsertStandardAudioAssetInput,
): Promise<StandardAudioAsset> {
  const [row] = await db
    .insert(standardAudioAssets)
    .values({
      cacheKey: input.cacheKey,
      provider: input.provider,
      objectKey: input.objectKey,
      format: input.format,
      codec: input.codec,
      sampleRate: input.sampleRate,
      durationMs: input.durationMs,
      sizeBytes: input.sizeBytes,
      voice: input.voice,
      speed: input.speed,
      language: input.language,
    })
    .onConflictDoUpdate({
      target: standardAudioAssets.cacheKey,
      set: {
        provider: input.provider,
        objectKey: input.objectKey,
        format: input.format,
        codec: input.codec,
        sampleRate: input.sampleRate,
        durationMs: input.durationMs,
        sizeBytes: input.sizeBytes,
        voice: input.voice,
        speed: input.speed,
        language: input.language,
      },
    })
    .returning();

  return toStandardAudioAsset(row);
}

export function createDbStandardAudioMetadataRepository(
  db: TalkForgeDatabase,
): StandardAudioMetadataRepository {
  return {
    findByCacheKey: (cacheKey) => findStandardAudioAssetByCacheKey(db, cacheKey),
    upsert: (input) => upsertStandardAudioAsset(db, input),
  };
}
