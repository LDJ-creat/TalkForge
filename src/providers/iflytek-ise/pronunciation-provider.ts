import { createProviderError } from "@/providers/errors";
import { executeProviderCall } from "@/providers/runtime";
import type { PronunciationEvaluationProvider } from "@/providers/pronunciation/contract";
import type {
  PronunciationEvaluateInput,
  PronunciationEvaluationResult,
} from "@/providers/pronunciation/types";

import {
  DEFAULT_IFLYTEK_ISE_WS_URL,
  IFLYTEK_ISE_PROVIDER_NAME,
  type IflytekIseProviderConfig,
} from "./config";
import { normalizeIflytekIseEvaluation } from "./normalize";
import type { LoadedPronunciationAudioObject } from "./types";
import { evaluateIflytekIseShadowingAudio } from "./websocket-client";

export type CreateIflytekIsePronunciationProviderOptions = Partial<IflytekIseProviderConfig> & {
  appId: string;
  apiKey: string;
  apiSecret: string;
  loadAudio: (input: { objectKey: string }) => Promise<LoadedPronunciationAudioObject>;
  prepareAudio?: (input: LoadedPronunciationAudioObject) => Promise<Buffer>;
  evaluateAudio?: typeof evaluateIflytekIseShadowingAudio;
};

export class IflytekIsePronunciationProvider implements PronunciationEvaluationProvider {
  readonly name = IFLYTEK_ISE_PROVIDER_NAME;
  private readonly config: IflytekIseProviderConfig;
  private readonly loadAudio: CreateIflytekIsePronunciationProviderOptions["loadAudio"];
  private readonly prepareAudio: NonNullable<
    CreateIflytekIsePronunciationProviderOptions["prepareAudio"]
  >;
  private readonly evaluateAudio: NonNullable<
    CreateIflytekIsePronunciationProviderOptions["evaluateAudio"]
  >;

  constructor(options: CreateIflytekIsePronunciationProviderOptions) {
    if (!options.appId.trim()) {
      throw createProviderError({
        provider: IFLYTEK_ISE_PROVIDER_NAME,
        code: "configuration",
        message: "PRONUNCIATION_APP_ID is required for the iFlytek ISE provider.",
        retryable: false,
      });
    }

    if (!options.apiKey.trim()) {
      throw createProviderError({
        provider: IFLYTEK_ISE_PROVIDER_NAME,
        code: "configuration",
        message: "PRONUNCIATION_API_KEY is required for the iFlytek ISE provider.",
        retryable: false,
      });
    }

    if (!options.apiSecret.trim()) {
      throw createProviderError({
        provider: IFLYTEK_ISE_PROVIDER_NAME,
        code: "configuration",
        message: "PRONUNCIATION_API_SECRET is required for the iFlytek ISE provider.",
        retryable: false,
      });
    }

    this.config = {
      appId: options.appId,
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      wsBaseUrl: options.wsBaseUrl ?? DEFAULT_IFLYTEK_ISE_WS_URL,
    };
    this.loadAudio = options.loadAudio;
    this.prepareAudio = options.prepareAudio ?? (async (audio) => audio.body);
    this.evaluateAudio = options.evaluateAudio ?? evaluateIflytekIseShadowingAudio;
  }

  async evaluate(input: PronunciationEvaluateInput): Promise<PronunciationEvaluationResult> {
    if (input.mode !== "shadowing") {
      throw createProviderError({
        provider: this.name,
        code: "invalid_request",
        message:
          "The iFlytek ISE provider only supports shadowing evaluation. Free conversation uses lightweight mock scoring.",
        retryable: false,
      });
    }

    if (!input.referenceText?.trim()) {
      throw createProviderError({
        provider: this.name,
        code: "invalid_request",
        message: "Shadowing evaluation requires referenceText.",
        retryable: false,
      });
    }

    const { result } = await executeProviderCall({
      provider: this.name,
      operation: "pronunciation.evaluate",
      fn: async (context) => {
        let audio: LoadedPronunciationAudioObject;
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

        let pcmAudio: Buffer;
        try {
          pcmAudio = await this.prepareAudio(audio);
        } catch (error) {
          if (error && typeof error === "object" && "code" in error) {
            throw error;
          }

          throw createProviderError({
            provider: this.name,
            code: "invalid_request",
            message:
              error instanceof Error
                ? error.message
                : "Uploaded audio could not be converted for pronunciation evaluation.",
            retryable: false,
            cause: error,
          });
        }

        const response = await this.evaluateAudio(this.config, {
          pcmAudio,
          referenceText: input.referenceText!.trim(),
          context,
        });

        return normalizeIflytekIseEvaluation(response, {
          referenceText: input.referenceText!.trim(),
        });
      },
    });

    return result;
  }
}

export function createIflytekIsePronunciationProvider(
  options: CreateIflytekIsePronunciationProviderOptions,
): IflytekIsePronunciationProvider {
  return new IflytekIsePronunciationProvider(options);
}
