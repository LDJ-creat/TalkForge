import { getRuntimeConfig } from "@/server/config";
import type { AiTracingConfig } from "@/server/config/types";

export function getAiTracingConfig(): AiTracingConfig {
  return getRuntimeConfig().aiTracing;
}

export function shouldSampleAiTrace(
  config: AiTracingConfig,
  randomValue = Math.random(),
): boolean {
  if (!config.enabled) {
    return false;
  }
  if (config.sampleRate >= 1) {
    return true;
  }
  if (config.sampleRate <= 0) {
    return false;
  }
  return randomValue < config.sampleRate;
}

export function shouldCaptureRawRequest(config: AiTracingConfig): boolean {
  return config.enabled && config.captureRawRequest && config.rawStorageBackend !== "none";
}

export function shouldCaptureRawResponse(config: AiTracingConfig): boolean {
  return config.enabled && config.captureRawResponse && config.rawStorageBackend !== "none";
}
