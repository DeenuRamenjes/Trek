import type { TrekDb } from '../../db/client';
import { listLogs, listReminders } from '../../db/repositories';
import { addDaysTo } from '../../domain/dates';
import { logicalToday } from '../../domain/dayBoundary';
import {
  MAX_PENDING_NOTIFICATIONS,
  planReminders,
  type PlannedReminder,
} from '../../domain/reminderPlanner';
import type { Settings } from '../../domain/settings';
import { loadGoalContexts } from '../../features/goals/goalContexts';
import { strings } from '../../strings/en';
import type { notificationsAdapter as Adapter } from './adapter';
import { BACKUP_CHANNEL, REVIEWS_CHANNEL, goalChannelId, syncChannels } from './channels';
import { renderContent } from './content';
import { GOAL_CATEGORY, SNOOZE_ID_PREFIX } from './categories';
import { dateTrigger, weeklyTrigger } from './triggers';
import { toExpoWeekday } from './weekday';

export type ReconcilerAdapter = Pick<
  typeof Adapter,
  'schedule' | 'cancel' | 'listScheduled' | 'setChannel' | 'deleteChannel' | 'listChannels'
>;

export type ReconcileDeps = {
  db: TrekDb;
  adapter: ReconcilerAdapter;
  settings: Settings;
  now?: Date;
  platform?: 'ios' | 'android' | 'web' | string;
};

export type ReconcileResult = { scheduled: number; cancelled: number; desired: number };

const channelFor = (p: PlannedReminder): string =>
  p.category === 'goal' && p.goalId ? goalChannelId(p.goalId) : p.category === 'review' ? REVIEWS_CHANNEL : BACKUP_CHANNEL;

function buildRequest(p: PlannedReminder, appLockEnabled: boolean) {
  const content = renderContent(p, { appLockEnabled });
  const channelId = channelFor(p);
  const trigger =
    p.kind === 'weekly'
      ? weeklyTrigger(toExpoWeekday(p.weekday), p.hour, p.minute, channelId)
      : dateTrigger(new Date(p.at), channelId);
  const signature = p.kind === 'weekly' ? `w${p.weekday}-${p.hour}-${p.minute}` : `d${p.at}`;
  const contentKey = JSON.stringify([content.title, content.body, content.url, signature, content.data.goalId ?? null]);
  return {
    identifier: p.id,
    content: {
      title: content.title,
      body: content.body,
      data: { ...content.data, contentKey },
      ...(p.category === 'goal' ? { categoryIdentifier: GOAL_CATEGORY } : {}),
    },
    trigger,
    contentKey,
  };
}

/**
 * Loads inputs, plans, then diffs desired vs scheduled by id: cancels ids no longer desired and
 * (re)schedules ids that are missing or whose content key changed. Snooze notifications (`s:`) are
 * left alone and count against the iOS cap of 64.
 */
export async function reconcile(deps: ReconcileDeps): Promise<ReconcileResult> {
  const { db, adapter, settings } = deps;
  const now = deps.now ?? new Date();
  const ctxs = await loadGoalContexts(db, { dayEndsAt: settings.dayEndsAt });
  const today = logicalToday(now, settings.dayEndsAt);
  const logs = await listLogs(db, { from: addDaysTo(today, -7) });
  const createdAts = ctxs.map((c) => c.goal.createdAt).sort();

  const scheduled = await adapter.listScheduled();
  const snoozes = scheduled.filter((n) => n.identifier.startsWith(SNOOZE_ID_PREFIX));
  const existing = new Map(
    scheduled.filter((n) => !n.identifier.startsWith(SNOOZE_ID_PREFIX)).map((n) => [n.identifier, n]),
  );

  const planned = planReminders({
    now,
    ctxs,
    reminders: await listReminders(db),
    logs,
    settings,
    earliestGoalCreatedAt: createdAts[0] ?? null,
  }).slice(0, Math.max(0, MAX_PENDING_NOTIFICATIONS - snoozes.length));

  if (deps.platform === 'android') {
    await syncChannels(
      adapter,
      ctxs.map((c) => ({ id: c.goal.id, name: c.goal.name })),
      { reviews: strings.notifications.reviewsChannel, backup: strings.notifications.backupChannel },
    );
  }

  const desiredIds = new Set(planned.map((p) => p.id));
  let cancelled = 0;
  for (const id of existing.keys()) {
    if (desiredIds.has(id)) continue;
    await adapter.cancel(id);
    cancelled++;
  }
  let count = 0;
  for (const p of planned) {
    const { contentKey, ...request } = buildRequest(p, settings.appLock.enabled);
    const current = existing.get(p.id)?.content.data as { contentKey?: string } | undefined;
    if (current?.contentKey === contentKey) continue;
    await adapter.schedule(request);
    count++;
  }
  return { scheduled: count, cancelled, desired: planned.length };
}
