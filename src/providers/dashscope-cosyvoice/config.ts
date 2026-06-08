export const DASHSCOPE_COSYVOICE_PROVIDER_NAME = "cosyvoice" as const;

export const DEFAULT_DASHSCOPE_TTS_API_BASE_URL = "https://dashscope.aliyuncs.com";

export const DEFAULT_DASHSCOPE_COSYVOICE_MODEL = "cosyvoice-v1";

/** Bilingual voice suitable for English learner standard audio. */
export const DEFAULT_DASHSCOPE_COSYVOICE_VOICE = "longxiaochun_v3";

export const DEFAULT_DASHSCOPE_COSYVOICE_SAMPLE_RATE = 24000;

export type DashScopeCosyVoiceProviderConfig = {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  defaultVoice: string;
  sampleRate: number;
};

export function buildDashScopeCosyVoiceSynthesisUrl(apiBaseUrl: string): string {
  const normalized = apiBaseUrl.replace(/\/+$/, "");
  return `${normalized}/api/v1/services/audio/tts/SpeechSynthesizer`;
}

export function isSupportedCosyVoiceProviderName(name: string): boolean {
  return name === DASHSCOPE_COSYVOICE_PROVIDER_NAME;
}
