import { loadEnvFile } from "./load-env";

loadEnvFile();

import { Queue } from "bullmq";
import { resolveQueueConfig } from "../src/queue/config";

const sessionId = process.argv[2] ?? "afeb6247-b0a9-4eca-abef-e36415ef87a4";
const jobId = `shadowing-${sessionId}`;

async function main() {
  const config = resolveQueueConfig({ redisUrl: process.env.REDIS_URL });
  const queue = new Queue(config.queueName, {
    connection: { url: config.redisUrl!, maxRetriesPerRequest: null },
    prefix: config.prefix,
  });

  const job = await queue.getJob(jobId);
  if (!job) {
    console.log("shadowing job: NOT FOUND", jobId);
  } else {
    const state = await job.getState();
    console.log("shadowing job:", {
      id: job.id,
      name: job.name,
      state,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      data: job.data,
    });
  }

  const reportJob = await queue.getJob(`report-${sessionId}`);
  if (!reportJob) {
    console.log("report job: NOT FOUND");
  } else {
    console.log("report job:", {
      id: reportJob.id,
      name: reportJob.name,
      state: await reportJob.getState(),
      failedReason: reportJob.failedReason,
    });
  }

  const failed = await queue.getFailed(0, 20);
  const related = failed.filter((j) => j.id?.includes(sessionId.slice(0, 8)));
  console.log(
    "recent failed jobs for session prefix:",
    related.map((j) => ({ id: j.id, name: j.name, reason: j.failedReason })),
  );

  await queue.close();
}

main().catch(console.error);
