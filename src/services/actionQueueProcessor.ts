import { and, eq, isNull } from 'drizzle-orm';
import type { TrekDb } from '../db/client';
import { goals, logs, pendingActions } from '../db/schema';
import { listUnprocessed, markProcessed } from '../db/repositories/pendingActions';
import { upsertLogTx } from '../db/repositories/logs';
import { withTransaction } from '../db/transaction';
import { applyAction, processQueue } from '../domain/actionQueue';
import { strings } from '../strings/en';
import { notificationsAdapter } from './notifications/adapter';
import { GOAL_CATEGORY, SNOOZE_ID_PREFIX } from './notifications/categories';
import { timeIntervalTrigger } from './notifications/triggers';

export { SNOOZE_ID_PREFIX };

/**
 * Applies every unprocessed action once, oldest first. Each action runs in its own transaction
 * (log upsert + markProcessed), so a crash leaves later actions pending and applied ones done.
 * Actions for missing or archived goals are marked processed without a log change.
 */
export async function processPendingActions(db: TrekDb, now: Date = new Date()): Promise<number> {
  const queue = processQueue(await listUnprocessed(db));
  let applied = 0;
  for (const action of queue) {
    const goal = (await db.select().from(goals).where(eq(goals.id, action.goalId)))[0];
    const at = now.toISOString();
    if (!goal || goal.archivedAt) {
      await markProcessed(db, action.id, at);
      continue;
    }
    if (action.action === 'snooze') {
      const result = applyAction({ goal }, action);
      if (result.kind === 'reschedule') {
        await notificationsAdapter.schedule({
          identifier: `${SNOOZE_ID_PREFIX}${action.id}`,
          content: {
            title: goal.name,
            body: strings.notifications.snoozeBody,
            data: { goalId: goal.id, date: action.date, slotId: action.slotId ?? null },
            categoryIdentifier: GOAL_CATEGORY,
          },
          trigger: timeIntervalTrigger(result.minutes * 60),
        });
      }
      await markProcessed(db, action.id, at);
      applied++;
      continue;
    }
    await withTransaction(db, async (tx) => {
      const slotId = action.slotId ?? null;
      const existing = (
        await tx
          .select()
          .from(logs)
          .where(
            and(
              eq(logs.goalId, action.goalId),
              eq(logs.date, action.date),
              slotId === null ? isNull(logs.slotId) : eq(logs.slotId, slotId),
            ),
          )
      )[0];
      const result = applyAction({ goal, existing }, action);
      if (result.kind === 'log') await upsertLogTx(tx, result.upsert);
      await tx.update(pendingActions).set({ processedAt: at }).where(eq(pendingActions.id, action.id));
    });
    applied++;
  }
  return applied;
}
