import { loadEnvFile } from "./load-env";

loadEnvFile();

import { getRuntimeConfig } from "@/server/config";
import { getQueueAdapter } from "@/server/queue/provider";
import { enqueueSessionReportGeneration } from "@/server/report/enqueue-session-report";

const sessionId = process.argv[2];

async function main() {
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/retry-session-report.ts <sessionId>");
    process.exit(1);
  }

  const { providers } = getRuntimeConfig();
  if (providers.queue.name !== "redis") {
    console.warn(
      "[talkforge:retry-report] QUEUE_PROVIDER is not redis; using in-process queue adapter.",
    );
  }

  const queue = getQueueAdapter();
  const job = await enqueueSessionReportGeneration(queue, sessionId);
  console.log("Enqueued report.generate:", job);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
