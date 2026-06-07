import type { ProviderErrorCode } from "@/providers/errors";
import { errorCopy, usageLimitCopy } from "@/lib/ui-copy";

import { classifyProviderErrorCode, classifySessionServiceErrorCode } from "./error-categories";

export function mapProviderErrorToUserMessage(
  code?: ProviderErrorCode | string,
  fallback = errorCopy.providerFallback,
): string {
  const category = classifyProviderErrorCode(code);

  switch (category) {
    case "provider_configuration":
    case "provider_authentication":
    case "provider_authorization":
      return errorCopy.providerConfig;
    case "provider_rate_limit":
      return errorCopy.providerRateLimit;
    case "provider_timeout":
      return errorCopy.providerTimeout;
    case "provider_unavailable":
      return errorCopy.providerUnavailable;
    case "provider_invalid_request":
      return fallback;
    default:
      return fallback;
  }
}

export function mapApiErrorCodeToUserMessage(
  code: string,
  fallback?: string,
): string {
  const sessionCategory = classifySessionServiceErrorCode(code);
  if (sessionCategory === "session_usage_limit") {
    switch (code) {
      case "session_turn_limit":
        return usageLimitCopy.turnLimit;
      case "session_duration_limit":
        return usageLimitCopy.durationLimit;
      case "session_asr_limit":
        return usageLimitCopy.asrLimit;
      case "session_report_limit":
        return usageLimitCopy.reportLimit;
    }
  }

  if (code === "realtime_unavailable") {
    return mapProviderErrorToUserMessage("provider_unavailable");
  }

  return fallback ?? errorCopy.generic;
}
