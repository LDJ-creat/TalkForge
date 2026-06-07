import { loadEnvFile } from "./load-env";

loadEnvFile();

import { closeDb, getDb } from "@/server/db/client";
import { bootstrapDevData } from "@/server/db/seeds/bootstrap";

async function main() {
  const db = getDb();
  const result = await bootstrapDevData(db);

  console.info(
    `[talkforge:seed] Dev user ${result.userId} and ${result.scenarioCount} scenarios are ready.`,
  );
}

main()
  .catch((error) => {
    console.error("[talkforge:seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
