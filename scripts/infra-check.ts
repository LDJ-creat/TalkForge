import { loadEnvFile } from "./load-env";

loadEnvFile();

import { checkInfrastructureHealth } from "@/server/infrastructure";

async function main() {
  const report = await checkInfrastructureHealth();

  console.info("[talkforge:infra] Health report:");
  console.info(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[talkforge:infra] Health check failed:", error);
  process.exitCode = 1;
});
