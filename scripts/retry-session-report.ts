import { loadEnvFile } from "./load-env";

loadEnvFile();

import { createQueueAdapter } from "@/queue/factory";
import { enqueueSessionReportGeneration } from "@/server/report/enqueue-session-report";

const sessionId = process.argv[2];

async function main() {
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/retry-session-report.ts <sessionId>");
    process.exit(1);
  }

  const queue = createQueueAdapter();
  const job = await enqueueSessionReportGeneration(queue, sessionId);
  console.log("Enqueued report.generate:", job);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
