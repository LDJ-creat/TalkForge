import { desc, eq } from "drizzle-orm";

import { loadEnvFile } from "./load-env";
import { closeDb, getDb } from "../src/server/db/client";
import {
  aiInvocationLogs,
  corrections,
  reports,
  sessions,
  turns,
} from "../src/server/db/schema";

loadEnvFile();

const sessionId = process.argv[2];

if (!sessionId) {
  console.error("Usage: npx tsx scripts/inspect-session-report.ts <sessionId>");
  process.exit(1);
}

async function main() {
  const db = getDb();

  const [session] = await db
    .select({
      status: sessions.status,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  console.log("session", session ?? null);

  const [report] = await db.select().from(reports).where(eq(reports.sessionId, sessionId));
  if (report) {
    console.log("report", {
      summary: report.summary.slice(0, 120),
      isPlaceholder: report.summary.startsWith("__talkforge"),
      createdAt: report.createdAt,
    });
  } else {
    console.log("report", null);
  }

  const userTurns = await db
    .select({
      id: turns.id,
      transcriptText: turns.transcriptText,
      evaluationStatus: turns.evaluationStatus,
      audioSegmentId: turns.audioSegmentId,
    })
    .from(turns)
    .where(eq(turns.sessionId, sessionId));

  console.log(
    "userTurns",
    userTurns.filter((turn) => turn.transcriptText).map((turn) => ({
      id: turn.id.slice(0, 8),
      text: turn.transcriptText?.slice(0, 40),
      eval: turn.evaluationStatus,
      audio: Boolean(turn.audioSegmentId),
    })),
  );

  const turnIds = userTurns.map((turn) => turn.id);
  if (turnIds.length > 0) {
    const correctionRows = await db
      .select({ turnId: corrections.turnId, type: corrections.type })
      .from(corrections);
    console.log(
      "corrections",
      correctionRows.filter((row) => turnIds.includes(row.turnId)).length,
    );
  }

  const reportLogs = await db
    .select({
      operation: aiInvocationLogs.operation,
      status: aiInvocationLogs.status,
      model: aiInvocationLogs.model,
      latencyMs: aiInvocationLogs.latencyMs,
      retryCount: aiInvocationLogs.retryCount,
      errorCode: aiInvocationLogs.errorCode,
      errorMessage: aiInvocationLogs.errorMessage,
      createdAt: aiInvocationLogs.createdAt,
    })
    .from(aiInvocationLogs)
    .where(eq(aiInvocationLogs.sessionId, sessionId))
    .orderBy(desc(aiInvocationLogs.createdAt));

  console.log("aiLogs", reportLogs);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    process.exit(process.exitCode ?? 0);
  });
