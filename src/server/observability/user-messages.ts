import type { ProviderErrorCode } from "@/providers/errors";

import { classifyProviderErrorCode, classifySessionServiceErrorCode } from "./error-categories";

export function mapProviderErrorToUserMessage(
  code?: ProviderErrorCode | string,
  fallback = "A provider service is temporarily unavailable. Please try again.",
): string {
  const category = classifyProviderErrorCode(code);

  switch (category) {
    case "provider_configuration":
    case "provider_authentication":
    case "provider_authorization":
      return "Voice or teaching services are not fully configured. Please contact support if this continues.";
    case "provider_rate_limit":
      return "The service is busy right now. Wait a moment and try again.";
    case "provider_timeout":
      return "The request took too long. Check your connection and try again.";
    case "provider_unavailable":
      return "Voice or teaching services are temporarily unavailable. You can retry or continue in text practice mode.";
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
        return "This practice session reached the turn limit. End practice to review your report.";
      case "session_duration_limit":
        return "This practice session reached the time limit. End practice to review your report.";
      case "session_asr_limit":
        return "This session reached the transcription limit. End practice and review available feedback.";
      case "session_report_limit":
        return "Report generation is temporarily unavailable for this session. Please try again later.";
    }
  }

  if (code === "realtime_unavailable") {
    return mapProviderErrorToUserMessage("provider_unavailable");
  }

  return fallback ?? "Something went wrong. Please try again.";
}
