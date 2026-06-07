import { getSessionDurationSec } from "@/domain/scenario-ending";
import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import { getRuntimeConfig } from "@/server/config";

import { resolveEffectiveSessionLimits } from "./session-limits";

const DEFAULT_REALTIME_TOKEN_TTL_SEC = 600;

export function resolveRealtimeTokenTtlSec(input: {
  session: Pick<Session, "startedAt" | "endedAt">;
  scenario: Scenario;
  configuredTokenTtlSec?: number;
  now?: Date;
}): number {
  const limits = getRuntimeConfig().sessionUsageLimits;
  const effective = resolveEffectiveSessionLimits(input.scenario.exitPolicy, limits);
  const durationSec = getSessionDurationSec(input.session, input.now);
  const remainingDurationSec = Math.max(1, effective.maxDurationSec - durationSec);
  const configuredTtl = input.configuredTokenTtlSec ?? DEFAULT_REALTIME_TOKEN_TTL_SEC;

  return Math.min(remainingDurationSec, configuredTtl);
}
