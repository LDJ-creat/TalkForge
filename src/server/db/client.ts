import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { schema } from "./schema";

export type TalkForgeDatabase = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | undefined;
let database: TalkForgeDatabase | undefined;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required to initialize the TalkForge database client.",
    );
  }
  return url;
}

export function createDatabase(url = getDatabaseUrl()): TalkForgeDatabase {
  const connection = postgres(url, { max: 1 });
  return drizzle(connection, { schema });
}

export function getDb(): TalkForgeDatabase {
  if (!database) {
    client = postgres(getDatabaseUrl(), { max: 1 });
    database = drizzle(client, { schema });
  }
  return database;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = undefined;
    database = undefined;
  }
}

export { schema };
