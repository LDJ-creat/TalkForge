import { eq } from "drizzle-orm";

import type { TalkForgeDatabase } from "../client";
import { users } from "../schema";

export async function getUserById(db: TalkForgeDatabase, userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function ensureUserExists(db: TalkForgeDatabase, userId: string) {
  const existing = await getUserById(db, userId);
  if (existing) {
    return existing;
  }

  const [row] = await db.insert(users).values({ id: userId }).returning();
  return row;
}
