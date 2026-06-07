import type { SessionLimitViolation } from "@/domain/session-usage-limits";
import { usageLimitCopy } from "@/lib/ui-copy";

export function sessionLimitViolationMessage(violation: SessionLimitViolation): string {
  switch (violation) {
    case "turn_limit":
      return usageLimitCopy.turnLimit;
    case "duration_limit":
      return usageLimitCopy.durationLimit;
    case "asr_limit":
      return usageLimitCopy.asrLimit;
    case "report_limit":
      return usageLimitCopy.reportLimit;
  }
}

export function resolveUsageLimitBannerMessage(limits: {
  turnLimitReached: boolean;
  durationLimitReached: boolean;
  asrLimitReached: boolean;
}): string | null {
  if (limits.turnLimitReached) {
    return sessionLimitViolationMessage("turn_limit");
  }
  if (limits.durationLimitReached) {
    return sessionLimitViolationMessage("duration_limit");
  }
  if (limits.asrLimitReached) {
    return sessionLimitViolationMessage("asr_limit");
  }
  return null;
}

export function isSessionUsageBlocked(limits: {
  turnLimitReached: boolean;
  durationLimitReached: boolean;
  asrLimitReached: boolean;
}): boolean {
  return (
    limits.turnLimitReached ||
    limits.durationLimitReached ||
    limits.asrLimitReached
  );
}
