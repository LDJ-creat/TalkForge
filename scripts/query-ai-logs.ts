import { desc, eq } from "drizzle-orm";

import { loadEnvFile } from "./load-env";
import { closeDb, getDb } from "@/server/db/client";
import { aiInvocationLogs } from "@/server/db/schema";

loadEnvFile();

const sessionId = process.argv[2];

async function main() {
  const db = getDb();
  const query = db
    .select({
      operation: aiInvocationLogs.operation,
      status: aiInvocationLogs.status,
      errorCode: aiInvocationLogs.errorCode,
      errorMessage: aiInvocationLogs.errorMessage,
      model: aiInvocationLogs.model,
      provider: aiInvocationLogs.provider,
      createdAt: aiInvocationLogs.createdAt,
    })
    .from(aiInvocationLogs)
    .orderBy(desc(aiInvocationLogs.createdAt))
    .limit(10);

  const rows = sessionId
    ? await query.where(eq(aiInvocationLogs.sessionId, sessionId))
    : await query;

  console.log(JSON.stringify(rows, null, 2));
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
