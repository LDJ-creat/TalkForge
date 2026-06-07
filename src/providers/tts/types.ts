import type { AudioCodec, AudioFormat } from "@/domain/enums";
import type { ProviderMetadata } from "../types";

export type TtsSynthesizeInput = {
  text: string;
  voice?: string;
  speed?: number;
  language?: "en";
};

export type TtsAudioResult = {
  provider: string;
  objectKey: string;
  format: AudioFormat;
  codec?: AudioCodec;
  sampleRate?: number;
  durationMs?: number;
  sizeBytes: number;
  metadata?: ProviderMetadata;
};

export type TtsCacheKeyInput = {
  text: string;
  voice?: string;
  speed?: number;
  provider: string;
  language?: "en";
};
