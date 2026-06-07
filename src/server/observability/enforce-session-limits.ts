import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { Turn } from "@/domain/turn";
import { getRuntimeConfig } from "@/server/config";
import { SessionServiceError } from "@/server/session/errors";
import { AudioUploadServiceError } from "@/server/storage/errors";
import { JobProcessingError } from "@/queue/errors";

import { logOperationalAlert } from "./log";
import {
  sessionLimitViolationErrorCode,
  sessionLimitViolationMessage,
  type SessionLimitViolation,
} from "./session-limits";
import { buildSessionUsageView, findSessionLimitViolation } from "./session-usage";

export type AssertSessionLimitInput = {
  scenario: Scenario;
  session: Pick<Session, "startedAt" | "endedAt" | "id">;
  turns: Turn[];
  asrInvocationCount?: number;
  reportAttemptsUsed?: number;
  pending?: Partial<{
    additionalUserTurns: number;
    additionalAsrJobs: number;
    additionalReportAttempts: number;
  }>;
};

function emitSessionLimitAlert(
  violation: SessionLimitViolation,
  sessionId: string,
): void {
  logOperationalAlert("session_limit_reached", {
    category: "session_usage_limit",
    sessionId,
    violation,
    code: sessionLimitViolationErrorCode(violation),
  });
}

export function assertSessionWithinLimitsOrThrow(
  input: AssertSessionLimitInput,
): void {
  const limits = getRuntimeConfig().sessionUsageLimits;
  const violation = findSessionLimitViolation({
    scenario: input.scenario,
    session: input.session,
    turns: input.turns,
    limits,
    asrInvocationCount: input.asrInvocationCount,
    reportAttemptsUsed: input.reportAttemptsUsed,
    pending: input.pending,
  });

  if (!violation) {
    return;
  }

  emitSessionLimitAlert(violation, input.session.id);
  throw new SessionServiceError(
    409,
    sessionLimitViolationErrorCode(violation),
    sessionLimitViolationMessage(violation),
  );
}

export function assertSessionWithinLimitsForAudioOrThrow(
  input: AssertSessionLimitInput,
): void {
  const limits = getRuntimeConfig().sessionUsageLimits;
  const view = buildSessionUsageView({
    scenario: input.scenario,
    session: input.session,
    turns: input.turns,
    limits,
    asrInvocationCount: input.asrInvocationCount,
    reportAttemptsUsed: input.reportAttemptsUsed,
  });
  const projectedAsrJobs = view.asrJobsUsed + (input.pending?.additionalAsrJobs ?? 0);

  if (projectedAsrJobs < view.maxAsrJobs) {
    return;
  }

  const violation: SessionLimitViolation = "asr_limit";
  emitSessionLimitAlert(violation, input.session.id);
  throw new AudioUploadServiceError(
    409,
    sessionLimitViolationErrorCode(violation),
    sessionLimitViolationMessage(violation),
  );
}

export function assertSessionWithinReportLimitsOrThrow(
  input: AssertSessionLimitInput & { attempts: number },
): void {
  const limits = getRuntimeConfig().sessionUsageLimits;
  const projectedAttempts = (input.reportAttemptsUsed ?? 0) + 1;

  if (projectedAttempts <= limits.maxReportGenerationAttempts) {
    return;
  }

  const violation: SessionLimitViolation = "report_limit";
  emitSessionLimitAlert(violation, input.session.id);
  throw new JobProcessingError({
    code: "validation",
    message: sessionLimitViolationMessage(violation),
    attempts: input.attempts,
    retryable: false,
    metadata: {
      limitCode: sessionLimitViolationErrorCode(violation),
      category: "session_usage_limit",
    },
  });
}
