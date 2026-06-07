import type { Turn } from "@/domain/turn";

import { countAsrJobsFromTurns } from "./session-usage";

/**
 * ASR usage is the higher of persisted turn audio segments and traced provider
 * invocations so limits stay accurate when tracing is enabled or jobs retry.
 */
export function resolveAsrJobsUsed(input: {
  turns: Turn[];
  asrInvocationCount?: number;
}): number {
  return Math.max(countAsrJobsFromTurns(input.turns), input.asrInvocationCount ?? 0);
}
