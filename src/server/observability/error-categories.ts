import type { ProviderErrorCode } from "@/providers/errors";

export const OPERATIONAL_ERROR_CATEGORIES = [
  "provider_configuration",
  "provider_authentication",
  "provider_authorization",
  "provider_rate_limit",
  "provider_timeout",
  "provider_unavailable",
  "provider_invalid_request",
  "session_usage_limit",
  "internal",
] as const;

export type OperationalErrorCategory = (typeof OPERATIONAL_ERROR_CATEGORIES)[number];

export function classifyProviderErrorCode(
  code?: ProviderErrorCode | string,
): OperationalErrorCategory {
  switch (code) {
    case "configuration":
      return "provider_configuration";
    case "authentication":
      return "provider_authentication";
    case "authorization":
      return "provider_authorization";
    case "rate_limited":
      return "provider_rate_limit";
    case "timeout":
      return "provider_timeout";
    case "provider_unavailable":
      return "provider_unavailable";
    case "invalid_request":
    case "not_found":
      return "provider_invalid_request";
    default:
      return "internal";
  }
}

export function classifySessionServiceErrorCode(code: string): OperationalErrorCategory {
  if (
    code === "session_turn_limit" ||
    code === "session_duration_limit" ||
    code === "session_asr_limit" ||
    code === "session_report_limit"
  ) {
    return "session_usage_limit";
  }

  if (code === "realtime_unavailable") {
    return "provider_unavailable";
  }

  return "internal";
}
