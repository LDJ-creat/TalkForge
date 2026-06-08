import { loadEnvFile } from "./load-env";

loadEnvFile();

import { getDb } from "../src/server/db/client";
import { generateSessionShadowingContent } from "../src/server/shadowing/generate-session-shadowing";
import {
  createDbShadowingGenerateDeps,
} from "../src/workers/handlers/shadowing-generate";

const sessionId = process.argv[2] ?? "afeb6247-b0a9-4eca-abef-e36415ef87a4";

async function main() {
  const db = getDb();
  const deps = createDbShadowingGenerateDeps({ db });

  console.log("running shadowing.generate for", sessionId);

  const result = await generateSessionShadowingContent(
    { sessionId },
    deps,
    { attempts: 1 },
  );

  console.log("result:", {
    created: result.created,
    itemCount: result.items.length,
    statuses: result.items.map((item) => ({
      id: item.id,
      text: item.standardText,
      audioStatus: item.standardAudioStatus,
    })),
  });
}

main().catch((error) => {
  console.error("shadowing generation failed:", error);
  process.exitCode = 1;
});
