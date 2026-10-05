import type { Goal, Log } from './types';
import type { PendingAction } from '../db/schema';

/** Notification and widget action queue (CLAUDE.md 4.7). Pure. */

export type ActionSource = PendingAction['source'];
export type ActionKind = PendingAction['action'];

export type ActionKeyParts = {
  source: ActionSource;
  goalId: string;
  date: string;
  slotId?: string | null;
  action: ActionKind;
  /** Distinguishes separate user taps (widget tap id, notification response id/time). */
  nonce: string;
};

/** Deterministic idempotency key: the same tap always yields the same id. */
export function actionKey(p: ActionKeyParts): string {
  return [p.source, p.goalId, p.date, p.slotId ?? '-', p.action, p.nonce].join('|');
}

export const DEFAULT_SNOOZE_MINUTES = 10;

export type LogUpsert = {
  goalId: string;
  date: string;
  slotId: string | null;
  value: number;
  status: Log['status'];
  note: string | null;
};

export type ActionResult =
  | { kind: 'log'; upsert: LogUpsert }
  | { kind: 'reschedule'; goalId: string; date: string; slotId: string | null; minutes: number };

export type ApplyState = {
  goal: Pick<Goal, 'id' | 'trackingType' | 'targetValue'>;
  /** Existing log for (goalId, date, slotId), if any. */
  existing?: Pick<Log, 'value' | 'status' | 'note'> | null;
};

function target(goal: ApplyState['goal']): number {
  return goal.trackingType === 'check' ? 1 : goal.targetValue;
}

/** Pure reducer: the log upsert (or reschedule request) an action produces. */
export function applyAction(
  state: ApplyState,
  action: Pick<PendingAction, 'goalId' | 'date' | 'slotId' | 'action' | 'value'>,
): ActionResult {
  const slotId = action.slotId ?? null;
  const note = state.existing?.note ?? null;
  const base = { goalId: action.goalId, date: action.date, slotId };
  switch (action.action) {
    case 'done':
      return { kind: 'log', upsert: { ...base, value: target(state.goal), status: 'done', note } };
    case 'increment': {
      const current = state.existing?.status === 'skipped' ? 0 : (state.existing?.value ?? 0);
      const value = current + (action.value ?? 1);
      return {
        kind: 'log',
        upsert: { ...base, value, status: value >= target(state.goal) ? 'done' : 'partial', note },
      };
    }
    case 'skip':
      return { kind: 'log', upsert: { ...base, value: 0, status: 'skipped', note } };
    case 'snooze':
      return { kind: 'reschedule', ...base, minutes: action.value ?? DEFAULT_SNOOZE_MINUTES };
  }
}

/**
 * Actions still to apply, oldest first, each id at most once. Rows already marked processed,
 * ids in `processedIds`, and repeated ids in the batch are dropped.
 */
export function processQueue(
  pending: PendingAction[],
  processedIds: Iterable<string> = [],
): PendingAction[] {
  const seen = new Set(processedIds);
  const ordered = pending
    .filter((p) => !p.processedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ops: PendingAction[] = [];
  for (const p of ordered) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    ops.push(p);
  }
  return ops;
}
