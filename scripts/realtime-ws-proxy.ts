import { loadEnvFile } from "./load-env";

loadEnvFile();

import { maybeStartRealtimeWebSocketProxy } from "@/server/realtime/ws-proxy";

const runtime = maybeStartRealtimeWebSocketProxy();
if (!runtime) {
  console.info(
    "[talkforge:realtime-proxy] Skipped (REALTIME_PROVIDER is not qwen-omni or proxy is disabled).",
  );
  process.exit(0);
}

const shutdown = (signal: string) => {
  console.info(`[talkforge:realtime-proxy] Received ${signal}, shutting down.`);
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
