import type { AudioCodec, AudioFormat } from "./enums";

export type AudioSegment = {
  id: string;
  turnId: string;
  objectKey: string;
  format: AudioFormat;
  codec?: AudioCodec;
  sampleRate?: number;
  durationMs: number;
  sizeBytes: number;
  createdAt: string;
};

export type CreateAudioSegmentInput = {
  turnId: string;
  objectKey: string;
  format: AudioFormat;
  codec?: AudioCodec;
  sampleRate?: number;
  durationMs: number;
  sizeBytes: number;
};
