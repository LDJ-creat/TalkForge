import { createProviderError } from "@/providers/errors";
import type { AsrProvider } from "@/providers/asr/contract";
import type { AsrTranscribeInput, AsrTranscriptionResult } from "@/providers/asr/types";
import { executeProviderCall } from "@/providers/runtime";

import {
  DEFAULT_DASHSCOPE_API_BASE_URL,
  DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
  DASHSCOPE_PARAFORMER_PROVIDER_NAME,
  type DashScopeParaformerProviderConfig,
} from "./config";
import { normalizeDashScopeParaformerResponse } from "./normalize";
import {
  transcribeDashScopeParaformerAudio,
  type TranscribeDashScopeParaformerAudioInput,
} from "./websocket-client";

export type LoadAudioObjectInput = {
  objectKey: string;
};

export type LoadedAudioObject = {
  body: Buffer;
  contentType?: string;
  objectKey: string;
};

export type CreateDashScopeParaformerAsrProviderOptions = Partial<DashScopeParaformerProviderConfig> & {
  apiKey: string;
  loadAudio: (input: LoadAudioObjectInput) => Promise<LoadedAudioObject>;
  prepareAudio?: (input: LoadedAudioObject) => Promise<Buffer>;
  transcribeAudio?: (
    config: DashScopeParaformerProviderConfig,
    input: TranscribeDashScopeParaformerAudioInput,
  ) => ReturnType<typeof transcribeDashScopeParaformerAudio>;
};

export class DashScopeParaformerAsrProvider implements AsrProvider {
  readonly name = DASHSCOPE_PARAFORMER_PROVIDER_NAME;
  private readonly config: DashScopeParaformerProviderConfig;
  private readonly loadAudio: CreateDashScopeParaformerAsrProviderOptions["loadAudio"];
  private readonly prepareAudio: NonNullable<
    CreateDashScopeParaformerAsrProviderOptions["prepareAudio"]
  >;
  private readonly transcribeAudio: NonNullable<
    CreateDashScopeParaformerAsrProviderOptions["transcribeAudio"]
  >;

  constructor(options: CreateDashScopeParaformerAsrProviderOptions) {
    if (!options.apiKey.trim()) {
      throw createProviderError({
        provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
        code: "configuration",
        message: "ASR_API_KEY is required for the DashScope Paraformer ASR provider.",
        retryable: false,
      });
    }

    this.config = {
      apiKey: options.apiKey,
      apiBaseUrl: options.apiBaseUrl ?? DEFAULT_DASHSCOPE_API_BASE_URL,
      model: options.model ?? DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
    };
    this.loadAudio = options.loadAudio;
    this.prepareAudio = options.prepareAudio ?? (async (audio) => audio.body);
    this.transcribeAudio = options.transcribeAudio ?? transcribeDashScopeParaformerAudio;
  }

  async transcribe(input: AsrTranscribeInput): Promise<AsrTranscriptionResult> {
    const { result } = await executeProviderCall({
      provider: this.name,
      operation: "asr.transcribe",
      fn: async (context) => {
        let audio: LoadedAudioObject;
        try {
          audio = await this.loadAudio({ objectKey: input.audioObjectKey });
        } catch (error) {
          throw createProviderError({
            provider: this.name,
            code: "not_found",
            message:
              error instanceof Error
                ? error.message
                : `Audio object ${input.audioObjectKey} could not be loaded.`,
            retryable: false,
            cause: error,
          });
        }

        const pcmAudio = await this.prepareAudio(audio);
        const response = await this.transcribeAudio(this.config, {
          pcmAudio,
          language: input.language,
          wordTimestamps: input.wordTimestamps,
          context,
        });

        return normalizeDashScopeParaformerResponse(response.sentences, {
          audioObjectKey: input.audioObjectKey,
          language: input.language,
          wordTimestamps: input.wordTimestamps,
          durationSec: response.durationSec,
        });
      },
    });

    return result;
  }
}

export function createDashScopeParaformerAsrProvider(
  options: CreateDashScopeParaformerAsrProviderOptions,
): DashScopeParaformerAsrProvider {
  return new DashScopeParaformerAsrProvider(options);
}
