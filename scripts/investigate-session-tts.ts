import { loadEnvFile } from "./load-env";

loadEnvFile();

import postgres from "postgres";

const sessionId = process.argv[2] ?? "afeb6247-b0a9-4eca-abef-e36415ef87a4";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 10 });

  const session = await sql`
    SELECT id, status, scenario_id, started_at, ended_at
    FROM sessions WHERE id = ${sessionId}
  `;

  const report = await sql`
    SELECT left(summary, 80) AS summary, shadowing_recommendations, created_at
    FROM reports WHERE session_id = ${sessionId}
  `;

  const shadowing = await sql`
    SELECT id, standard_text, standard_audio_status, sort_order, created_at
    FROM shadowing_items WHERE session_id = ${sessionId}
    ORDER BY sort_order
  `;

  const aiLogs = await sql`
    SELECT operation, provider, model, status, error_code, error_message, latency_ms, created_at
    FROM ai_invocation_logs
    WHERE session_id = ${sessionId}
    ORDER BY created_at
  `;

  console.log("=== session ===");
  console.log(session);
  console.log("=== report ===");
  console.log(report);
  console.log("=== shadowing_items ===");
  console.log(shadowing);
  console.log("=== ai_invocation_logs ===");
  console.log(aiLogs);

  await sql.end({ timeout: 5 });
}

main().catch(console.error);
