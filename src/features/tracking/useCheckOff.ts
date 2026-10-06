import { logCatch } from '../../services/errorLog';
import { useCallback, useRef, useState } from 'react';
import type { TrekDb } from '../../db/client';
import { deleteLog, listLogs, restoreLog, upsertLog } from '../../db/repositories';
import type { Log } from '../../db/schema';
import { applyAction, type ActionKind } from '../../domain/actionQueue';
import { currentStreak, milestoneReached } from '../../domain/streaks';
import type { GoalContext } from '../../domain/types';
import { strings } from '../../strings/en';
import { haptic } from './haptics';
import type { TodayRow } from './todayModel';

export const DURATION_STEP = 5;

export type CheckOp =
  | { kind: 'done' | 'skip' | 'clear'; slotId?: string | null }
  | { kind: 'increment'; value?: number }
  | { kind: 'set'; value: number; note?: string | null };

type Entry = { prev: Log | null; created: Log | null; goalId: string; date: string; slotId: string | null };
export type UndoState = { id: number; message: string; entries: Entry[] };

type Args = { db: TrekDb; contexts: GoalContext[]; today: string; weekStart: number };

const sameKey = (l: Pick<Log, 'goalId' | 'date' | 'slotId'>, goalId: string, date: string, slotId: string | null) =>
  l.goalId === goalId && l.date === date && (l.slotId ?? null) === slotId;

/** Applies check-off operations through `applyAction`, tracks the undo state and detects streak milestones. */
export function useCheckOff({ db, contexts, today, weekStart }: Args) {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [milestone, setMilestone] = useState<{ id: number; days: number } | null>(null);
  const counter = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  /** Runs `fn` after every earlier act/undo finished, so rapid taps never read a stale log. */
  const serial = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(fn, fn);
    chain.current = next.catch(logCatch('checkOff'));
    return next;
  }, []);

  const run = useCallback(
    async (row: TodayRow, date: string, op: CheckOp) => {
      const ctx = contexts.find((c) => c.goal.id === row.goalId);
      if (!ctx) return;
      const current = await listLogs(db, { goalId: row.goalId });
      const find = (slotId: string | null) => current.find((l) => sameKey(l, row.goalId, date, slotId)) ?? null;
      const slotted = row.slots.length > 0;
      const wholeRow = op.kind === 'done' || op.kind === 'skip' || op.kind === 'clear' || op.kind === 'set';
      const slotIds: (string | null)[] =
        slotted && wholeRow && !('slotId' in op && op.slotId) ? row.slots.map((s) => s.id) : [('slotId' in op && op.slotId) || null];

      const entries: Entry[] = [];
      let after = [...current];
      let anyDone = false;
      for (const slotId of slotIds) {
        const prev = find(slotId);
        if (op.kind === 'clear' || (op.kind === 'set' && op.value <= 0)) {
          if (prev) {
            await deleteLog(db, prev.id);
            after = after.filter((l) => l.id !== prev.id);
            entries.push({ prev, created: null, goalId: row.goalId, date, slotId });
          }
          continue;
        }
        let input: { value: number; status: Log['status']; note: string | null };
        if (op.kind === 'set') {
          const target = row.trackingType === 'check' ? 1 : row.target;
          input = { value: op.value, status: op.value >= target ? 'done' : 'partial', note: op.note ?? prev?.note ?? null };
        } else {
          const action: ActionKind = op.kind;
          const r = applyAction(
            { goal: { id: ctx.goal.id, trackingType: ctx.goal.trackingType, targetValue: ctx.goal.targetValue }, existing: prev },
            { goalId: row.goalId, date, slotId, action, value: op.kind === 'increment' ? (op.value ?? 1) : null },
          );
          if (r.kind !== 'log') continue;
          input = r.upsert;
        }
        const saved = await upsertLog(db, { goalId: row.goalId, date, slotId, ...input });
        after = [...after.filter((l) => !sameKey(l, row.goalId, date, slotId)), saved];
        entries.push({ prev, created: prev ? null : saved, goalId: row.goalId, date, slotId });
        if (input.status === 'done') anyDone = true;
      }
      if (entries.length === 0) return;

      let days: number | null = null;
      if (anyDone) {
        const before = currentStreak(ctx, current, today, weekStart);
        days = milestoneReached(before, currentStreak(ctx, after, today, weekStart));
      }
      const id = ++counter.current;
      const t = strings.today;
      const message =
        days != null
          ? t.toastMilestone(row.name, days)
          : op.kind === 'done'
            ? t.toastDone(row.name)
            : op.kind === 'skip'
              ? t.toastSkipped(row.name)
              : op.kind === 'clear'
                ? t.toastCleared(row.name)
                : anyDone && op.kind === 'increment'
                  ? t.toastDone(row.name)
                  : t.toastUpdated(row.name);
      haptic(anyDone ? 'success' : 'tap');
      setUndoState({ id, message, entries });
      if (days != null) setMilestone({ id, days });
    },
    [db, contexts, today, weekStart],
  );

  const act = useCallback((row: TodayRow, date: string, op: CheckOp) => serial(() => run(row, date, op)), [serial, run]);

  const undo = useCallback(async () => {
    const state = undoState;
    if (!state) return;
    setUndoState(null);
    await serial(async () => {
      for (const e of [...state.entries].reverse()) {
        if (e.prev) await restoreLog(db, e.prev);
        else if (e.created) await deleteLog(db, e.created.id);
      }
    });
  }, [db, undoState, serial]);

  return {
    act,
    undo,
    undoState,
    dismissUndo: useCallback(() => setUndoState(null), []),
    milestone,
    clearMilestone: useCallback(() => setMilestone(null), []),
  };
}
