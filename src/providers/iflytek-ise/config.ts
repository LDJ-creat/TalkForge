export const IFLYTEK_ISE_PROVIDER_NAME = "iflytek-ise-pronunciation" as const;

export const IFLYTEK_ISE_PROVIDER_ID = "iflytek-ise" as const;

/** 流式版开放评测地址，见 https://www.xfyun.cn/doc/Ise/IseAPI.html */
export const DEFAULT_IFLYTEK_ISE_WS_URL = "wss://ise-api.xfyun.cn/v2/open-ise";

/** Mono PCM s16le sample rate required by iFlytek ISE. */
export const IFLYTEK_ISE_SAMPLE_RATE = 16000;

/** 40ms of mono PCM s16le at 16kHz. */
export const IFLYTEK_ISE_PCM_CHUNK_BYTES = 1280;

export type IflytekIseProviderConfig = {
  appId: string;
  apiKey: string;
  apiSecret: string;
  wsBaseUrl: string;
};

export function isSupportedIflytekIseProviderName(name: string): boolean {
  return name === IFLYTEK_ISE_PROVIDER_ID;
}
