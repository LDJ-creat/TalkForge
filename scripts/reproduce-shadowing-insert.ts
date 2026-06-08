import { loadEnvFile } from "./load-env";

loadEnvFile();

import postgres from "postgres";

const sessionId = "afeb6247-b0a9-4eca-abef-e36415ef87a4";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 10 });

  const enums = await sql`
    SELECT e.enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'shadowing_item_source'
    ORDER BY e.enumsortorder
  `;
  console.log("enum values:", enums.map((row) => row.enumlabel));

  const tables = await sql`
    SELECT to_regclass('public.shadowing_items') AS shadowing_items
  `;
  console.log("table:", tables);

  const turn = await sql`
    SELECT id FROM turns WHERE id = 'dc1bfbba-9db8-4a7e-afe5-4c814d93c7ce'
  `;
  console.log("turn exists:", turn);

  try {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM shadowing_items WHERE session_id = ${sessionId}`;

      await tx`
        INSERT INTO shadowing_items (
          id, session_id, standard_text, original_text, reason, source, turn_id, sort_order, standard_audio_status
        )
        VALUES
        (
          'shadowing-report_recommendation-0-would-you-like-it-hot-or-iced',
          ${sessionId},
          'Would you like it hot or iced?',
          NULL,
          '这是咖啡店询问冷热饮的常见标准句型，适合跟读以掌握自然语调。',
          'report_recommendation',
          NULL,
          0,
          'pending'
        ),
        (
          'shadowing-report_recommendation-1-that-comes-to-4-50',
          ${sessionId},
          'That comes to $4.50.',
          NULL,
          '这是结账时告知总价的地道表达，跟读有助于熟悉结账场景的常用语。',
          'report_recommendation',
          NULL,
          1,
          'pending'
        ),
        (
          'shadowing-corrected_expression-2-let-s-stop-practicing',
          ${sessionId},
          'let''s stop practicing',
          'let''s end the practice',
          '"end the practice" test',
          'corrected_expression',
          'dc1bfbba-9db8-4a7e-afe5-4c814d93c7ce',
          2,
          'pending'
        ),
        (
          'shadowing-scenario_target_expression-3-could-i-get-a-medium-latte',
          ${sessionId},
          'Could I get a medium latte?',
          NULL,
          'Target expression from Order Coffee at a Cafe.',
          'scenario_target_expression',
          NULL,
          3,
          'pending'
        ),
        (
          'shadowing-scenario_target_expression-4-can-i-have-it-iced',
          ${sessionId},
          'Can I have it iced?',
          NULL,
          'Target expression from Order Coffee at a Cafe.',
          'scenario_target_expression',
          NULL,
          4,
          'pending'
        )
      `;

      throw new Error("rollback");
    });
  } catch (error) {
    console.error("insert error:", error);
  }

  const conflicts = await sql`
    SELECT id, session_id, standard_text
    FROM shadowing_items
    WHERE id IN (
      'shadowing-scenario_target_expression-3-could-i-get-a-medium-latte',
      'shadowing-scenario_target_expression-4-can-i-have-it-iced',
      'shadowing-report_recommendation-0-would-you-like-it-hot-or-iced'
    )
  `;
  console.log("existing conflicting ids:", conflicts);

  await sql.end({ timeout: 5 });
}

main().catch(console.error);
