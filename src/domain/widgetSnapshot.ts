import { dayStatus, slotsForDate } from './dayStatus';
import { isDue } from './scheduleEngine';
import type { GoalContext, Log } from './types';

/** Widget content (CLAUDE.md 5.13). Pure. */

export const WIDGET_MAX_ITEMS = 4;

export type WidgetItemStatus = 'done' | 'partial' | 'pending';

export type WidgetItem = {
  goalId: string;
  /** null when goal names are hidden. */
  name: string | null;
  status: WidgetItemStatus;
  /** 0..1 */
  progress: number;
  /** True for count goals: a tap increments instead of marking done. */
  increment: boolean;
  /** Next undone slot (by time) of a slotted check goal; null otherwise. A tap logs against it. */
  slotId: string | null;
};

export type WidgetSnapshot = {
  date: string;
  done: number;
  total: number;
  items: WidgetItem[];
};

export type WidgetSnapshotInput = {
  ctxs: GoalContext[];
  logs: Log[];
  today: string;
  /** Goal ids of the selected group; null/undefined = all goals. */
  groupGoalIds?: string[] | null;
  hideGoalNames: boolean;
};

function nextUndoneSlot(ctx: GoalContext, logs: Log[], today: string): string | null {
  if (ctx.goal.trackingType !== 'check') return null;
  const slots = [...slotsForDate(ctx, today)].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1));
  const next = slots.find(
    (s) => !logs.some((l) => l.goalId === ctx.goal.id && l.date === today && l.slotId === s.id && l.status === 'done'),
  );
  return next?.id ?? null;
}

const ORDER: Record<WidgetItemStatus, number> = { partial: 0, pending: 1, done: 2 };

export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const allowed = input.groupGoalIds ? new Set(input.groupGoalIds) : null;
  const rows: (WidgetItem & { sort: number })[] = [];
  for (const ctx of input.ctxs) {
    if (allowed && !allowed.has(ctx.goal.id)) continue;
    if (!isDue(ctx, input.today)) continue;
    const info = dayStatus(ctx, input.logs, input.today, input.today);
    if (info.status !== 'done' && info.status !== 'partial' && info.status !== 'pending') continue;
    rows.push({
      goalId: ctx.goal.id,
      name: input.hideGoalNames ? null : ctx.goal.name,
      status: info.status,
      progress: info.status === 'done' ? 1 : info.ratio,
      increment: ctx.goal.trackingType === 'count',
      slotId: nextUndoneSlot(ctx, input.logs, input.today),
      sort: ctx.goal.sortOrder,
    });
  }
  rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.sort - b.sort || (a.goalId < b.goalId ? -1 : 1));
  return {
    date: input.today,
    done: rows.filter((r) => r.status === 'done').length,
    total: rows.length,
    items: rows.slice(0, WIDGET_MAX_ITEMS).map(({ sort: _s, ...item }) => item),
  };
}
