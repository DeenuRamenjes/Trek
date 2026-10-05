import type { TrekDb } from '../../db/client';
import { enqueueAction } from '../../db/repositories/pendingActions';
import type { NewPendingAction } from '../../db/schema';
import { logicalDate } from '../../domain/dayBoundary';
import { processPendingActions } from '../actionQueueProcessor';
import type { NotificationResponse } from './adapter';

export const MARK_DONE_ACTION = 'mark-done';
export const SNOOZE_ACTION = 'snooze';

const ACTIONS = { [MARK_DONE_ACTION]: 'done', [SNOOZE_ACTION]: 'snooze' } as const;

/**
 * Pending action for a notification button press, or null for a plain tap / unknown action.
 * id = n:<requestId>:<deliveredAtMs>:<actionId>, so the same response never enqueues twice.
 */
export function actionFromResponse(response: NotificationResponse, dayEndsAt: number): NewPendingAction | null {
  const action = ACTIONS[response.actionIdentifier as keyof typeof ACTIONS];
  if (!action) return null;
  const { request, date } = response.notification;
  const data = (request.content.data ?? {}) as { goalId?: unknown; date?: unknown; slotId?: unknown };
  if (typeof data.goalId !== 'string') return null;
  const deliveredAt = new Date(date * 1000);
  const logical = typeof data.date === 'string' ? data.date : logicalDate(deliveredAt, dayEndsAt);
  return {
    id: `n:${request.identifier}:${Math.round(date * 1000)}:${response.actionIdentifier}`,
    source: 'notification',
    goalId: data.goalId,
    date: logical,
    slotId: typeof data.slotId === 'string' ? data.slotId : null,
    action,
    value: null,
    createdAt: new Date().toISOString(),
    processedAt: null,
  };
}

/** Enqueue (conflict-do-nothing) then process. Returns false for responses with no action. */
export async function recordResponse(db: TrekDb, response: NotificationResponse, dayEndsAt: number): Promise<boolean> {
  const row = actionFromResponse(response, dayEndsAt);
  if (!row) return false;
  await enqueueAction(db, row);
  await processPendingActions(db);
  return true;
}
