import { createProviderError } from "../errors";
import type { AsrProvider } from "../asr/contract";
import type { AsrTranscribeInput, AsrTranscriptionResult } from "../asr/types";

export type MockAsrProviderOptions = {
  name?: string;
  defaultConfidence?: number;
  missingObjectKeys?: Set<string>;
  failOnTranscribe?: boolean;
};

export class MockAsrProvider implements AsrProvider {
  readonly name: string;
  private readonly defaultConfidence: number;
  private readonly missingObjectKeys: Set<string>;
  private readonly failOnTranscribe: boolean;
  private readonly transcripts = new Map<string, AsrTranscriptionResult>();

  constructor(options: MockAsrProviderOptions = {}) {
    this.name = options.name ?? "mock-asr";
    this.defaultConfidence = options.defaultConfidence ?? 0.92;
    this.missingObjectKeys = options.missingObjectKeys ?? new Set();
    this.failOnTranscribe = options.failOnTranscribe ?? false;
  }

  setTranscript(audioObjectKey: string, result: Omit<AsrTranscriptionResult, "provider">): void {
    this.transcripts.set(audioObjectKey, {
      ...result,
      provider: this.name,
    });
  }

  async transcribe(input: AsrTranscribeInput): Promise<AsrTranscriptionResult> {
    if (this.failOnTranscribe) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock ASR provider is configured to fail.",
      });
    }

    if (this.missingObjectKeys.has(input.audioObjectKey)) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Audio object ${input.audioObjectKey} was not found.`,
      });
    }

    const preset = this.transcripts.get(input.audioObjectKey);
    if (preset) {
      return preset;
    }

    const text = `Mock transcript for ${input.audioObjectKey}`;
    const segments = [
      {
        startMs: 0,
        endMs: 1800,
        text,
        words: input.wordTimestamps
          ? text.split(" ").map((word, index) => ({
              word,
              startMs: index * 300,
              endMs: index * 300 + 250,
              confidence: this.defaultConfidence,
            }))
          : undefined,
      },
    ];

    return {
      provider: this.name,
      text,
      confidence: this.defaultConfidence,
      segments,
      metadata: {
        audioObjectKey: input.audioObjectKey,
        language: input.language ?? "en",
        mock: true,
      },
    };
  }
}

export function createMockAsrProvider(options?: MockAsrProviderOptions): MockAsrProvider {
  return new MockAsrProvider(options);
}
