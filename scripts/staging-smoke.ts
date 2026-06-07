import { loadEnvFile } from "./load-env";

loadEnvFile();

import { getDb } from "@/server/db/client";
import { listAiInvocationLogsBySessionId } from "@/server/db/repositories";
import { checkInfrastructureHealth } from "@/server/infrastructure";
import { buildObservabilityStatusReport } from "@/server/observability/status-report";

const REQUIRED_TRACE_OPERATIONS = [
  "realtime.session.create",
  "asr.transcribe",
  "llm.correction",
  "llm.scenarioJudge",
  "llm.report",
  "tts.generate",
  "pronunciation.evaluate",
] as const;

function readSessionIdArg(): string | undefined {
  const index = process.argv.indexOf("--session-id");
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const sessionId = readSessionIdArg();

  console.info("[talkforge:staging] TalkForge P1 staging smoke check");
  console.info(
    "[talkforge:staging] Full manual checklist: plans/talkforge-p1/staging-readiness.md",
  );

  const infra = await checkInfrastructureHealth();
  console.info("\n[talkforge:staging] Infrastructure:");
  console.info(JSON.stringify(infra, null, 2));

  let db: ReturnType<typeof getDb> | undefined;
  try {
    db = getDb();
  } catch (error) {
    console.warn(
      "[talkforge:staging] Database unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  if (db) {
    const observability = await buildObservabilityStatusReport({ db });
    console.info("\n[talkforge:staging] Provider and trace summary:");
    console.info(
      JSON.stringify(
        {
          ok: observability.ok,
          providers: observability.providers,
          aiInvocations: observability.aiInvocations,
          providerBreakdown: observability.providerBreakdown,
        },
        null,
        2,
      ),
    );
  }

  if (sessionId && db) {
    const traces = await listAiInvocationLogsBySessionId(db, sessionId, 200);
    const operations = new Set(traces.map((trace) => trace.operation));
    const missing = REQUIRED_TRACE_OPERATIONS.filter(
      (operation) => !operations.has(operation),
    );

    console.info(`\n[talkforge:staging] AI traces for session ${sessionId}:`);
    console.info(
      JSON.stringify(
        traces.map((trace) => ({
          operation: trace.operation,
          provider: trace.provider,
          model: trace.model,
          status: trace.status,
          latencyMs: trace.latencyMs,
          turnId: trace.turnId,
          createdAt: trace.createdAt,
        })),
        null,
        2,
      ),
    );

    if (missing.length > 0) {
      console.warn(
        `[talkforge:staging] Missing expected trace operations: ${missing.join(", ")}`,
      );
      process.exitCode = 1;
    } else {
      console.info("[talkforge:staging] All expected trace operations are present.");
    }
  } else if (sessionId) {
    console.warn(
      "[talkforge:staging] Skipped per-session trace listing because DATABASE_URL is unavailable.",
    );
    process.exitCode = 1;
  } else {
    console.info(
      "\n[talkforge:staging] Tip: pass --session-id <uuid> after a manual staging run to verify AI invocation traces.",
    );
  }

  if (!infra.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[talkforge:staging] Smoke check failed:", error);
  process.exitCode = 1;
});
