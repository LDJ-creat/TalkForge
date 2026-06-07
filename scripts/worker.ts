import { loadEnvFile } from "./load-env";

loadEnvFile();

import { checkInfrastructureHealth } from "@/server/infrastructure";
import { maybeStartRealtimeWebSocketProxy } from "@/server/realtime/ws-proxy";
import { startBullMQWorkerProcess } from "@/workers/start-bullmq-worker";

async function main() {
  maybeStartRealtimeWebSocketProxy();

  const health = await checkInfrastructureHealth();
  if (!health.ok) {
    console.error("[talkforge:worker] Infrastructure is not ready:");
    console.error(JSON.stringify(health, null, 2));
    process.exitCode = 1;
    return;
  }

  const processHandle = startBullMQWorkerProcess();
  console.info("[talkforge:worker] BullMQ worker started.");

  const shutdown = async (signal: string) => {
    console.info(`[talkforge:worker] Received ${signal}, shutting down.`);
    await processHandle.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  console.error("[talkforge:worker] Failed to start worker:", error);
  process.exitCode = 1;
});
