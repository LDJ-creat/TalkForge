import type { AudioCodec, AudioFormat } from "./enums";

export type StandardAudioAsset = {
  id: string;
  cacheKey: string;
  provider: string;
  objectKey: string;
  format: AudioFormat;
  codec?: AudioCodec;
  sampleRate?: number;
  durationMs?: number;
  sizeBytes: number;
  voice: string;
  speed: number;
  language: "en";
  createdAt: string;
};

export type UpsertStandardAudioAssetInput = Omit<
  StandardAudioAsset,
  "id" | "createdAt"
> & {
  id?: string;
  createdAt?: string;
};
