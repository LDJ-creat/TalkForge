import { and, desc, eq, sql } from "drizzle-orm";

import type { CreateReportInput, Report } from "@/domain/report";
import type {
  ScenarioHistoricalReport,
  ScenarioHistoricalReportStatus,
} from "@/domain/scenario-report-history";
import {
  REPORT_GENERATING_MARKER,
  REPORT_IN_PROGRESS_WINDOW_MS,
} from "@/server/report/constants";

import type { TalkForgeDatabase } from "../client";
import { toReport } from "../mappers";
import { reports, sessions } from "../schema";

const DEFAULT_SCENARIO_REPORT_HISTORY_LIMIT = 20;

export function isReportGenerationComplete(report: Report): boolean {
  return report.summary !== REPORT_GENERATING_MARKER;
}

async function findReportBySessionId(db: TalkForgeDatabase, sessionId: string) {
  const [row] = await db
    .select()
    .from(reports)
    .where(eq(reports.sessionId, sessionId))
    .limit(1);

  return row ? toReport(row) : null;
}

/** Returns only finalized reports suitable for API responses. */
export async function getReportBySessionId(db: TalkForgeDatabase, sessionId: string) {
  const report = await findReportBySessionId(db, sessionId);
  if (!report || !isReportGenerationComplete(report)) {
    return null;
  }

  return report;
}

function resolveScenarioReportHistoryStatus(
  report: Report | null,
  now: Date,
): ScenarioHistoricalReportStatus {
  if (!report) {
    return "failed";
  }

  if (isReportGenerationComplete(report)) {
    return "ready";
  }

  const ageMs = now.getTime() - new Date(report.createdAt).getTime();
  if (ageMs < REPORT_IN_PROGRESS_WINDOW_MS) {
    return "generating";
  }

  return "failed";
}

export async function listScenarioReportHistoryForUser(
  db: TalkForgeDatabase,
  userId: string,
  scenarioId: string,
  limit = DEFAULT_SCENARIO_REPORT_HISTORY_LIMIT,
  options: { now?: () => Date } = {},
): Promise<ScenarioHistoricalReport[]> {
  const now = options.now ?? (() => new Date());

  const rows = await db
    .select({
      sessionId: sessions.id,
      sessionStartedAt: sessions.startedAt,
      sessionEndedAt: sessions.endedAt,
      report: reports,
    })
    .from(sessions)
    .leftJoin(reports, eq(reports.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.scenarioId, scenarioId),
        eq(sessions.status, "completed"),
      ),
    )
    .orderBy(
      desc(
        sql`coalesce(${reports.createdAt}, ${sessions.endedAt}, ${sessions.startedAt})`,
      ),
    )
    .limit(limit);

  return rows.map((row) => {
    const report = row.report ? toReport(row.report) : null;
    const status = resolveScenarioReportHistoryStatus(report, now());
    const evaluatedAt =
      report?.createdAt ?? row.sessionEndedAt ?? row.sessionStartedAt;

    return {
      sessionId: row.sessionId,
      sessionStartedAt: row.sessionStartedAt,
      sessionEndedAt: row.sessionEndedAt ?? undefined,
      evaluatedAt,
      status,
      report: status === "ready" && report ? report : undefined,
    };
  });
}

/** @deprecated Use listScenarioReportHistoryForUser. */
export async function listCompletedReportsByScenarioForUser(
  db: TalkForgeDatabase,
  userId: string,
  scenarioId: string,
  limit = DEFAULT_SCENARIO_REPORT_HISTORY_LIMIT,
): Promise<ScenarioHistoricalReport[]> {
  const history = await listScenarioReportHistoryForUser(db, userId, scenarioId, limit);
  return history.filter((item) => item.status === "ready" && item.report);
}

export type PrepareReportGenerationResult =
  | { status: "complete"; report: Report }
  | { status: "claimed"; report: Report }
  | { status: "resume"; report: Report }
  | { status: "in_progress" };

export type PrepareReportGenerationOptions = {
  now?: () => Date;
};

/**
 * Claims report generation under a session row lock so only one worker calls the LLM.
 * Recent generating placeholders are treated as in-progress and should be retried later.
 */
export async function prepareReportGeneration(
  db: TalkForgeDatabase,
  sessionId: string,
  options: PrepareReportGenerationOptions = {},
): Promise<PrepareReportGenerationResult> {
  const now = options.now ?? (() => new Date());

  return db.transaction(async (tx) => {
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .for("update");

    const existing = await findReportBySessionId(tx, sessionId);
    if (existing) {
      if (isReportGenerationComplete(existing)) {
        return { status: "complete", report: existing };
      }

      const ageMs = now().getTime() - new Date(existing.createdAt).getTime();
      if (ageMs < REPORT_IN_PROGRESS_WINDOW_MS) {
        return { status: "in_progress" };
      }

      return { status: "resume", report: existing };
    }

    const [row] = await tx
      .insert(reports)
      .values({
        sessionId,
        summary: REPORT_GENERATING_MARKER,
        taskCompletion: { completedGoalIds: [], missingGoalIds: [] },
        keyCorrections: [],
        alternativeExpressions: [],
        shadowingRecommendations: [],
        nextPracticeSuggestion: REPORT_GENERATING_MARKER,
      })
      .returning();

    return {
      status: "claimed",
      report: toReport(row),
    };
  });
}

export async function finalizeReport(
  db: TalkForgeDatabase,
  sessionId: string,
  input: CreateReportInput,
) {
  const [row] = await db
    .update(reports)
    .set({
      summary: input.summary,
      taskCompletion: input.taskCompletion,
      keyCorrections: input.keyCorrections,
      alternativeExpressions: input.alternativeExpressions,
      shadowingRecommendations: input.shadowingRecommendations,
      nextPracticeSuggestion: input.nextPracticeSuggestion,
    })
    .where(eq(reports.sessionId, sessionId))
    .returning();

  if (!row) {
    throw new Error(`Report for session ${sessionId} was not found during finalization.`);
  }

  return toReport(row);
}

export type SaveReportForSessionResult = {
  report: Report;
  created: boolean;
};

/** @deprecated Prefer prepareReportGeneration + finalizeReport for worker flows. */
export async function saveReportForSessionIfAbsent(
  db: TalkForgeDatabase,
  input: CreateReportInput,
): Promise<SaveReportForSessionResult> {
  const preparation = await prepareReportGeneration(db, input.sessionId);
  if (preparation.status === "complete") {
    return { report: preparation.report, created: false };
  }

  if (preparation.status === "in_progress") {
    throw new Error("Report generation is already in progress for this session.");
  }

  const report = await finalizeReport(db, input.sessionId, input);
  return {
    report,
    created: preparation.status === "claimed",
  };
}
