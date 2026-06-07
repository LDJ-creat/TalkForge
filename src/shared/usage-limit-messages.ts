import type { SessionLimitViolation } from "@/domain/session-usage-limits";

export function sessionLimitViolationMessage(violation: SessionLimitViolation): string {
  switch (violation) {
    case "turn_limit":
      return "This practice session reached the turn limit. End practice to review your report.";
    case "duration_limit":
      return "This practice session reached the time limit. End practice to review your report.";
    case "asr_limit":
      return "This session reached the transcription limit. End practice and review available feedback.";
    case "report_limit":
      return "Report generation is temporarily unavailable for this session. Please try again later.";
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
