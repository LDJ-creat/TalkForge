import { countUserTurns, getSessionDurationSec } from "@/domain/scenario-ending";
import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { Turn } from "@/domain/turn";
import type {
  SessionUsageLimitsConfig,
  SessionUsageSnapshot,
} from "@/domain/session-usage-limits";
import type { AiInvocationOperation } from "@/domain/ai-invocation-log";

import {
  buildSessionUsageLimitsView,
  detectSessionLimitViolation,
  type SessionLimitViolation,
} from "./session-limits";
import { resolveAsrJobsUsed } from "./resolve-asr-jobs-used";

export function countAsrJobsFromTurns(turns: Turn[]): number {
  return turns.filter((turn) => turn.role === "user" && turn.audioSegmentId).length;
}

export function buildSessionUsageSnapshot(input: {
  session: Pick<Session, "startedAt" | "endedAt">;
  turns: Turn[];
  asrInvocationCount?: number;
  reportAttemptsUsed?: number;
  now?: Date;
}): SessionUsageSnapshot {
  return {
    userTurnCount: countUserTurns(input.turns),
    durationSec: getSessionDurationSec(input.session, input.now),
    asrJobsUsed: resolveAsrJobsUsed({
      turns: input.turns,
      asrInvocationCount: input.asrInvocationCount,
    }),
    reportAttemptsUsed: input.reportAttemptsUsed ?? 0,
  };
}

export function buildSessionUsageView(input: {
  scenario: Scenario;
  session: Pick<Session, "startedAt" | "endedAt">;
  turns: Turn[];
  limits: SessionUsageLimitsConfig;
  asrInvocationCount?: number;
  reportAttemptsUsed?: number;
  now?: Date;
}) {
  const usage = buildSessionUsageSnapshot({
    session: input.session,
    turns: input.turns,
    asrInvocationCount: input.asrInvocationCount,
    reportAttemptsUsed: input.reportAttemptsUsed,
    now: input.now,
  });

  return buildSessionUsageLimitsView({
    exitPolicy: input.scenario.exitPolicy,
    config: input.limits,
    usage,
  });
}

export function countInvocationAttemptsByOperation(
  logs: Array<{ operation: AiInvocationOperation }>,
  operation: AiInvocationOperation,
): number {
  return logs.filter((log) => log.operation === operation).length;
}

export type AssertWithinSessionLimitInput = {
  scenario: Scenario;
  session: Pick<Session, "startedAt" | "endedAt">;
  turns: Turn[];
  limits: SessionUsageLimitsConfig;
  asrInvocationCount?: number;
  reportAttemptsUsed?: number;
  pending?: Partial<{
    additionalUserTurns: number;
    additionalAsrJobs: number;
    additionalReportAttempts: number;
  }>;
};

export function findSessionLimitViolation(
  input: AssertWithinSessionLimitInput,
): SessionLimitViolation | null {
  const view = buildSessionUsageView({
    scenario: input.scenario,
    session: input.session,
    turns: input.turns,
    limits: input.limits,
    asrInvocationCount: input.asrInvocationCount,
    reportAttemptsUsed: input.reportAttemptsUsed,
  });

  return detectSessionLimitViolation(
    {
      userTurnCount: view.userTurnCount,
      durationSec: view.durationSec,
      asrJobsUsed: view.asrJobsUsed,
      reportAttemptsUsed: view.reportAttemptsUsed,
    },
    {
      maxTurns: view.maxTurns,
      maxDurationSec: view.maxDurationSec,
      maxAsrJobs: view.maxAsrJobs,
      maxReportAttempts: view.maxReportAttempts,
    },
    input.pending,
  );
}
