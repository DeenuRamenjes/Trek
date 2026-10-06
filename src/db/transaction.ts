import { sql } from 'drizzle-orm';
import { emitDbChanged } from './changes';
import type { TrekDb } from './client';

// Tail of each db's queue. Calls on the same db run one at a time so BEGINs never nest.
const queues = new WeakMap<object, Promise<unknown>>();

/**
 * Runs fn between BEGIN and COMMIT, rolling back on throw. drizzle's own `db.transaction` on the
 * expo-sqlite sync driver commits before async callbacks run, so repositories use this instead.
 * Both drivers are single-connection, so statements issued on `db` join the transaction.
 * Calls on the same db are serialized. Not re-entrant: calling withTransaction from inside fn
 * on the same db deadlocks, so repositories must never nest it.
 */
export function withTransaction<T>(db: TrekDb, fn: (tx: TrekDb) => Promise<T>): Promise<T> {
  const previous = queues.get(db) ?? Promise.resolve();
  const run = async (): Promise<T> => {
    await db.run(sql`BEGIN`);
    let result: T;
    try {
      result = await fn(db);
      await db.run(sql`COMMIT`);
    } catch (e) {
      await db.run(sql`ROLLBACK`);
      throw e;
    }
    emitDbChanged();
    return result;
  };
  const next = previous.then(run, run);
  queues.set(db, next.catch(() => undefined));
  return next;
}
