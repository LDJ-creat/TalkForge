import type { StandardAudioAsset, UpsertStandardAudioAssetInput } from "@/domain/standard-audio-asset";
import type { StandardAudioMetadataRepository } from "@/providers/dashscope-cosyvoice";

export class InMemoryStandardAudioMetadataRepository
  implements StandardAudioMetadataRepository
{
  private readonly records = new Map<string, StandardAudioAsset>();

  async findByCacheKey(cacheKey: string): Promise<StandardAudioAsset | null> {
    return this.records.get(cacheKey) ?? null;
  }

  async upsert(input: UpsertStandardAudioAssetInput): Promise<StandardAudioAsset> {
    const existing = this.records.get(input.cacheKey);
    const record: StandardAudioAsset = {
      id: input.id ?? existing?.id ?? `standard-audio-${this.records.size + 1}`,
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
      createdAt: input.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    };

    this.records.set(input.cacheKey, record);
    return record;
  }

  clearForTests(): void {
    this.records.clear();
  }
}
