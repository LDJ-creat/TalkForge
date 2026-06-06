import type { TranscriptSegment } from "@/domain/transcript";
import type { ProviderMetadata } from "../types";

export type AsrTranscribeInput = {
  audioObjectKey: string;
  language?: "en";
  wordTimestamps?: boolean;
};

export type AsrTranscriptionResult = {
  provider: string;
  text: string;
  confidence?: number;
  segments: TranscriptSegment[];
  metadata?: ProviderMetadata;
};
