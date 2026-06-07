import type { ExitPolicy } from "@/domain/scenario";
import type {
  EffectiveSessionLimits,
  SessionLimitStatus,
  SessionLimitViolation,
  SessionUsageLimitsConfig,
  SessionUsageSnapshot,
  SessionUsageLimitsView,
} from "@/domain/session-usage-limits";
import {
  sessionLimitViolationMessage as sharedSessionLimitViolationMessage,
} from "@/shared/usage-limit-messages";

export type { SessionLimitViolation };

export function resolveEffectiveSessionLimits(
  exitPolicy: ExitPolicy,
  config: SessionUsageLimitsConfig,
): EffectiveSessionLimits {
  const maxTurns =
    config.maxTurns > 0
      ? Math.min(exitPolicy.maxTurns, config.maxTurns)
      : exitPolicy.maxTurns;

  const maxDurationSec =
    config.maxRealtimeDurationSec > 0
      ? Math.min(exitPolicy.maxDurationSec, config.maxRealtimeDurationSec)
      : exitPolicy.maxDurationSec;

  return {
    maxTurns,
    maxDurationSec,
    maxAsrJobs: config.maxAsrJobs,
    maxReportAttempts: config.maxReportGenerationAttempts,
  };
}

export function evaluateSessionLimitStatus(
  usage: SessionUsageSnapshot,
  limits: EffectiveSessionLimits,
): SessionLimitStatus {
  return {
    turnLimitReached: usage.userTurnCount >= limits.maxTurns,
    durationLimitReached: usage.durationSec >= limits.maxDurationSec,
    asrLimitReached: usage.asrJobsUsed >= limits.maxAsrJobs,
    reportLimitReached: usage.reportAttemptsUsed >= limits.maxReportAttempts,
  };
}

export function buildSessionUsageLimitsView(input: {
  exitPolicy: ExitPolicy;
  config: SessionUsageLimitsConfig;
  usage: SessionUsageSnapshot;
}): SessionUsageLimitsView {
  const effective = resolveEffectiveSessionLimits(input.exitPolicy, input.config);
  const status = evaluateSessionLimitStatus(input.usage, effective);

  return {
    ...effective,
    ...input.usage,
    ...status,
  };
}

export function detectSessionLimitViolation(
  usage: SessionUsageSnapshot,
  limits: EffectiveSessionLimits,
  pending?: Partial<{
    additionalUserTurns: number;
    additionalAsrJobs: number;
    additionalReportAttempts: number;
  }>,
): SessionLimitViolation | null {
  const projected: SessionUsageSnapshot = {
    userTurnCount: usage.userTurnCount + (pending?.additionalUserTurns ?? 0),
    durationSec: usage.durationSec,
    asrJobsUsed: usage.asrJobsUsed + (pending?.additionalAsrJobs ?? 0),
    reportAttemptsUsed:
      usage.reportAttemptsUsed + (pending?.additionalReportAttempts ?? 0),
  };

  const status = evaluateSessionLimitStatus(projected, limits);

  if (status.turnLimitReached) {
    return "turn_limit";
  }
  if (status.durationLimitReached) {
    return "duration_limit";
  }
  if (status.asrLimitReached) {
    return "asr_limit";
  }
  if (status.reportLimitReached) {
    return "report_limit";
  }

  return null;
}

export function sessionLimitViolationMessage(violation: SessionLimitViolation): string {
  return sharedSessionLimitViolationMessage(violation);
}

export function sessionLimitViolationErrorCode(
  violation: SessionLimitViolation,
): string {
  switch (violation) {
    case "turn_limit":
      return "session_turn_limit";
    case "duration_limit":
      return "session_duration_limit";
    case "asr_limit":
      return "session_asr_limit";
    case "report_limit":
      return "session_report_limit";
  }
}
