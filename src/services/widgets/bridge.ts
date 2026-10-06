import type { TrekDb } from '../../db/client';
import { enqueueAction, getGroup, listGroupGoals, listLogs } from '../../db/repositories';
import { logicalToday } from '../../domain/dayBoundary';
import type { Settings } from '../../domain/settings';
import { buildWidgetSnapshot } from '../../domain/widgetSnapshot';
import { loadGoalContexts } from '../../features/goals/goalContexts';
import { buildColors } from '../../ui/tokens';
import type { WidgetColors, WidgetPayload, WidgetPendingAction, WidgetsAdapter } from './adapter';

export type WidgetBridgeDeps = {
  db: TrekDb;
  adapter: WidgetsAdapter;
  getSettings: () => Settings;
  now?: () => Date;
};

export function resolveWidgetColors(accent: string): WidgetPayload['colors'] {
  const one = (mode: 'light' | 'dark'): WidgetColors => {
    const c = buildColors(mode, accent);
    return {
      background: c.background,
      surface: c.surface,
      surfaceMuted: c.surfaceMuted,
      border: c.border,
      textPrimary: c.textPrimary,
      textSecondary: c.textSecondary,
      accent: c.accent,
      onAccent: c.onAccent,
      done: c.status.done,
      partial: c.status.partial,
    };
  };
  return { light: one('light'), dark: one('dark') };
}

function parseAction(raw: unknown): WidgetPendingAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.startsWith('w:')) return null;
  if (typeof o.goalId !== 'string' || typeof o.date !== 'string') return null;
  if (o.action !== 'done' && o.action !== 'increment') return null;
  const slotId = typeof o.slotId === 'string' ? o.slotId : null;
  return { id: o.id, goalId: o.goalId, slotId, date: o.date, action: o.action };
}

export function createWidgetBridge(deps: WidgetBridgeDeps) {
  const now = deps.now ?? (() => new Date());

  /** Moves widget-recorded taps into pending_actions. Ids are tap-generated, so re-import is a no-op. */
  async function importWidgetActions(): Promise<number> {
    const raws = await deps.adapter.readPendingActions();
    let n = 0;
    for (const raw of raws) {
      const a = parseAction(raw);
      if (!a) continue;
      await enqueueAction(deps.db, {
        id: a.id,
        source: 'widget',
        goalId: a.goalId,
        date: a.date,
        slotId: a.slotId,
        action: a.action,
        value: null,
        createdAt: now().toISOString(),
        processedAt: null,
      });
      n++;
    }
    return n;
  }

  async function buildPayload(): Promise<WidgetPayload> {
    const s = deps.getSettings();
    const at = now();
    const today = logicalToday(at, s.dayEndsAt);
    const ctxs = await loadGoalContexts(deps.db, { dayEndsAt: s.dayEndsAt });
    const logs = await listLogs(deps.db, { from: today, to: today });
    let groupGoalIds: string[] | null = null;
    if (s.widget.groupId) {
      if (await getGroup(deps.db, s.widget.groupId)) {
        groupGoalIds = (await listGroupGoals(deps.db, s.widget.groupId)).map((l) => l.goalId);
      }
    }
    const snapshot = buildWidgetSnapshot({ ctxs, logs, today, groupGoalIds, hideGoalNames: s.widget.hideGoalNames });
    return {
      snapshot,
      colors: resolveWidgetColors(s.accentColor),
      hideGoalNames: s.widget.hideGoalNames,
      pendingActions: [],
    };
  }

  async function refreshWidgets(): Promise<void> {
    await importWidgetActions();
    await deps.adapter.pushSnapshot(await buildPayload());
  }

  return { importWidgetActions, buildPayload, refreshWidgets };
}
