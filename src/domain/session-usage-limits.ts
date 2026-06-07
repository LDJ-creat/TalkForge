export type SessionUsageLimitsConfig = {
  /** Hard cap on realtime session duration; 0 means scenario exit policy only. */
  maxRealtimeDurationSec: number;
  /** Hard cap on user turns; 0 means scenario exit policy only. */
  maxTurns: number;
  maxAsrJobs: number;
  maxReportGenerationAttempts: number;
};

export type SessionUsageSnapshot = {
  userTurnCount: number;
  durationSec: number;
  asrJobsUsed: number;
  reportAttemptsUsed: number;
};

export type EffectiveSessionLimits = {
  maxTurns: number;
  maxDurationSec: number;
  maxAsrJobs: number;
  maxReportAttempts: number;
};

export type SessionLimitStatus = {
  turnLimitReached: boolean;
  durationLimitReached: boolean;
  asrLimitReached: boolean;
  reportLimitReached: boolean;
};

export type SessionUsageLimitsView = EffectiveSessionLimits &
  SessionUsageSnapshot &
  SessionLimitStatus;

export type SessionLimitViolation =
  | "turn_limit"
  | "duration_limit"
  | "asr_limit"
  | "report_limit";
