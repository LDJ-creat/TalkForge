import { createProviderError, type ProviderErrorCode } from "@/providers/errors";
import type { ProviderCallContext } from "@/providers/runtime";

import {
  buildDashScopeCosyVoiceSynthesisUrl,
  DASHSCOPE_COSYVOICE_PROVIDER_NAME,
  type DashScopeCosyVoiceProviderConfig,
} from "./config";

export type DashScopeCosyVoiceSynthesisInput = {
  text: string;
  voice: string;
  speed: number;
  language: "en";
  context?: ProviderCallContext;
};

export type DashScopeCosyVoiceSynthesisResult = {
  audioBody: Buffer;
  format: "wav";
  sampleRate: number;
  durationMs?: number;
};

type DashScopeCosyVoiceResponse = {
  output?: {
    finish_reason?: string;
    audio?: {
      data?: string;
      url?: string;
    };
  };
  code?: string;
  message?: string;
  request_id?: string;
};

function clampSpeechRate(speed: number): number {
  if (!Number.isFinite(speed)) {
    return 1;
  }

  return Math.min(2, Math.max(0.5, speed));
}

function mapDashScopeTtsErrorCode(httpStatus: number, code?: string): ProviderErrorCode {
  if (httpStatus === 429 || code === "Throttling.RateQuota") {
    return "rate_limited";
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return "authentication";
  }
  if (httpStatus >= 500) {
    return "provider_unavailable";
  }
  return "invalid_request";
}

async function resolveDashScopeCosyVoiceAudioBody(
  payload: DashScopeCosyVoiceResponse,
  signal?: AbortSignal,
): Promise<Buffer | undefined> {
  const audio = payload.output?.audio;
  if (!audio) {
    return undefined;
  }

  if (audio.data && audio.data.trim().length > 0) {
    return Buffer.from(audio.data, "base64");
  }

  if (audio.url) {
    const downloadResponse = await fetch(audio.url, { signal });
    if (!downloadResponse.ok) {
      throw createProviderError({
        provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
        code: "invalid_request",
        message: `Failed to download CosyVoice audio from ${audio.url}.`,
        retryable: downloadResponse.status >= 500,
      });
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return undefined;
}

export async function synthesizeDashScopeCosyVoiceAudio(
  config: DashScopeCosyVoiceProviderConfig,
  input: DashScopeCosyVoiceSynthesisInput,
): Promise<DashScopeCosyVoiceSynthesisResult> {
  const text = input.text.trim();
  if (!text) {
    throw createProviderError({
      provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
      code: "invalid_request",
      message: "CosyVoice TTS requires non-empty text.",
      retryable: false,
    });
  }

  const response = await fetch(buildDashScopeCosyVoiceSynthesisUrl(config.apiBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: {
        text,
        voice: input.voice,
        format: "wav",
        sample_rate: config.sampleRate,
        rate: clampSpeechRate(input.speed),
        language_hints: [input.language],
      },
    }),
    signal: input.context?.signal,
  });

  const payload = (await response.json()) as DashScopeCosyVoiceResponse;

  if (!response.ok || payload.code) {
    throw createProviderError({
      provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
      code: mapDashScopeTtsErrorCode(response.status, payload.code),
      message:
        payload.message ??
        `DashScope CosyVoice TTS request failed with HTTP ${response.status}.`,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const audioBody = await resolveDashScopeCosyVoiceAudioBody(payload, input.context?.signal);
  if (!audioBody) {
    throw createProviderError({
      provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
      code: "invalid_request",
      message: "DashScope CosyVoice TTS response did not include audio data.",
      retryable: false,
    });
  }

  return {
    audioBody,
    format: "wav",
    sampleRate: config.sampleRate,
  };
}
