import { countUserTurns } from "@/domain/scenario-ending";
import type { Turn } from "@/domain/turn";

export function shouldEnqueueScenarioProgressJudge(
  userTurnCount: number,
  interval: number,
): boolean {
  const normalizedInterval = Math.max(1, Math.floor(interval));
  if (normalizedInterval === 1) {
    return true;
  }

  return userTurnCount > 0 && userTurnCount % normalizedInterval === 0;
}

export function countUserTurnsForSession(turns: Turn[]): number {
  return countUserTurns(turns);
}

export function resolveJudgeCurrentStageId(
  stageIds: string[],
  judgeStageId?: string,
): string | undefined {
  if (!judgeStageId) {
    return undefined;
  }

  return stageIds.includes(judgeStageId) ? judgeStageId : undefined;
}
