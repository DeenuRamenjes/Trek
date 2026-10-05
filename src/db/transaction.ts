import { sql } from 'drizzle-orm';
import type { TrekDb } from './client';

/**
 * Runs fn between BEGIN and COMMIT, rolling back on throw. drizzle's own `db.transaction` on the
 * expo-sqlite sync driver commits before async callbacks run, so repositories use this instead.
 * Both drivers are single-connection, so statements issued on `db` join the transaction.
 * Not re-entrant: do not nest.
 */
export async function withTransaction<T>(db: TrekDb, fn: (tx: TrekDb) => Promise<T>): Promise<T> {
  await db.run(sql`BEGIN`);
  try {
    const result = await fn(db);
    await db.run(sql`COMMIT`);
    return result;
  } catch (e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
}
