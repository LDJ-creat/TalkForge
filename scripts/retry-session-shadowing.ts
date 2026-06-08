import { loadEnvFile } from "./load-env";

loadEnvFile();

import { Queue } from "bullmq";

import { getDb } from "../src/server/db/client";
import {
  getReportBySessionId,
  listShadowingItemsBySessionId,
} from "../src/server/db/repositories";
import { getQueueAdapter } from "../src/server/queue/provider";
import { resolveQueueConfig } from "../src/queue/config";
import { ensureSessionShadowingGeneration } from "../src/server/shadowing/ensure-session-shadowing";

const sessionId = process.argv[2] ?? "afeb6247-b0a9-4eca-abef-e36415ef87a4";

async function main() {
  const db = getDb();
  const queueAdapter = getQueueAdapter();
  const report = await getReportBySessionId(db, sessionId);
  const shadowingItems = await listShadowingItemsBySessionId(db, sessionId);

  if (!report) {
    console.error("report not found for session", sessionId);
    process.exit(1);
  }

  console.log("before:", {
    shadowingItems: shadowingItems.length,
    recommendations: report.shadowingRecommendations.length,
  });

  const result = await ensureSessionShadowingGeneration({
    sessionId,
    report,
    shadowingItems,
    queueAdapter,
  });

  console.log("ensureSessionShadowingGeneration:", result);

  const config = resolveQueueConfig({ redisUrl: process.env.REDIS_URL });
  const queue = new Queue(config.queueName, {
    connection: { url: config.redisUrl!, maxRetriesPerRequest: null },
    prefix: config.prefix,
  });

  const job = await queue.getJob(`shadowing-${sessionId}`);
  if (job) {
    console.log("shadowing job:", {
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    });
  } else {
    console.log("shadowing job: not found");
  }

  await queue.close();
}

main().catch(console.error);
