import { asc, eq, isNull } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { emitDbChanged } from '../changes';
import { pendingActions, type NewPendingAction, type PendingAction } from '../schema';

/** The caller supplies the deterministic id; enqueueing the same id twice keeps one row. */
export async function enqueueAction(db: TrekDb, row: NewPendingAction): Promise<void> {
  await db.insert(pendingActions).values(row).onConflictDoNothing({ target: pendingActions.id });
  emitDbChanged();
}

export async function listUnprocessed(db: TrekDb): Promise<PendingAction[]> {
  return db.select().from(pendingActions).where(isNull(pendingActions.processedAt)).orderBy(asc(pendingActions.createdAt));
}

export async function markProcessed(db: TrekDb, id: string, at: string): Promise<void> {
  await db.update(pendingActions).set({ processedAt: at }).where(eq(pendingActions.id, id));
  emitDbChanged();
}
