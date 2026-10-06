import { isBackupOverdue } from './backupPolicy';
import { addDaysTo, eachDate, formatDate, isoWeekday, parseDate } from './dates';
import { logicalDate, logicalToday } from './dayBoundary';
import { effectiveVersion, isDue } from './scheduleEngine';
import type { Settings } from './settings';
import type { GoalContext, Log } from './types';
import { quotaMet } from './weekScoring';
import type { Reminder } from '../db/schema';

/**
 * Reminder planner (design 3.8, CLAUDE.md 5.9). Pure; works in device-local time.
 * Output carries no user-facing text: the notifications service renders `contentKey`
 * (+ `goalName`) from the strings file. Notes are never included.
 * `weekday` is ISO (0 = Monday).
 */

export const HORIZON_DAYS = 14;
export const MAX_PENDING_NOTIFICATIONS = 64;
export const WEEKLY_REVIEW_TIME = { hour: 19, minute: 0 };
export const MONTHLY_REVIEW_TIME = { hour: 9, minute: 0 };
export const BACKUP_REMINDER_TIME = { hour: 10, minute: 0 };

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlannedCategory = 'goal' | 'review' | 'backup';
export type PlannedContentKey = 'goalReminder' | 'weeklyReview' | 'monthlyReview' | 'backupReminder';

export type PlannedTrigger =
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }
  | { kind: 'date'; at: string };

export type PlannedReminder = PlannedTrigger & {
  /** Deterministic notification identifier. */
  id: string;
  category: PlannedCategory;
  contentKey: PlannedContentKey;
  goalId?: string;
  /** Goal name (never notes); only for goal reminders. */
  goalName?: string;
  /** Slot the reminder belongs to (goal reminders with a slot). */
  slotId?: string;
  /** Logical date of the occurrence; one-shot reminders only (weekly triggers repeat, so it is omitted). */
  date?: string;
  /** Deep link target for review notifications. */
  route?: 'review/week' | 'review/month';
  /** 0 goal, 1 review, 2 backup. */
  priority: number;
  /** ISO time of the first fire inside the horizon; sort key. */
  nextAt: string;
};

export type PlannerSettings = Pick<
  Settings,
  'dayEndsAt' | 'quietHours' | 'weekStart' | 'reviewNotifications' | 'backupReminderFrequency' | 'lastBackupAt'
>;

export type PlannerInput = {
  now: Date;
  ctxs: GoalContext[];
  reminders: Reminder[];
  /** Logs (at least the current week) for timesPerWeek quota checks. */
  logs: Log[];
  settings: PlannerSettings;
  /** Earliest goal createdAt, for the backup overdue rule. */
  earliestGoalCreatedAt?: string | null;
};

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function inQuietHours(fire: Date, quiet: Settings['quietHours']): boolean {
  if (!quiet) return false;
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === end) return false;
  const m = fire.getHours() * 60 + fire.getMinutes();
  return start < end ? m >= start && m < end : m >= start || m < end;
}

function localDateTime(date: string, hour: number, minute: number): Date {
  const d = parseDate(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
}

function inHorizon(fire: Date, now: Date): boolean {
  return fire.getTime() > now.getTime() && fire.getTime() <= now.getTime() + HORIZON_DAYS * DAY_MS;
}

function goalReminders(input: PlannerInput): PlannedReminder[] {
  const { now, settings } = input;
  const today = logicalToday(now, settings.dayEndsAt);
  const ctxById = new Map(input.ctxs.map((c) => [c.goal.id, c]));
  const localToday = formatDate(now);
  const days = eachDate(addDaysTo(localToday, -1), addDaysTo(localToday, HORIZON_DAYS + 1));
  const out: PlannedReminder[] = [];

  for (const r of input.reminders) {
    const ctx = ctxById.get(r.goalId);
    if (!r.enabled || !ctx) continue;
    const [hh, mm] = r.time.split(':').map(Number);
    const occurrences = days
      .filter((d) => isoWeekday(d) === r.weekday)
      .map((d) => localDateTime(d, hh, mm + r.offsetMin))
      .filter((fire) => inHorizon(fire, now));
    if (occurrences.length === 0) continue;

    const ok = occurrences.map((fire) => {
      if (inQuietHours(fire, settings.quietHours)) return false;
      const date = logicalDate(fire, settings.dayEndsAt);
      if (!isDue(ctx, date)) return false;
      return !quotaMet(ctx, input.logs, date, today, settings.weekStart) || effectiveVersion(ctx.versions, date)?.scheduleType !== 'timesPerWeek';
    });
    const common = {
      category: 'goal' as const,
      contentKey: 'goalReminder' as const,
      goalId: ctx.goal.id,
      goalName: ctx.goal.name,
      ...(r.slotId ? { slotId: r.slotId } : {}),
      priority: 0,
    };
    if (ok.every(Boolean)) {
      const first = occurrences[0];
      out.push({
        ...common,
        id: `goal:${r.id}:weekly`,
        kind: 'weekly',
        weekday: isoWeekday(formatDate(first)),
        hour: first.getHours(),
        minute: first.getMinutes(),
        nextAt: first.toISOString(),
      });
      continue;
    }
    occurrences.forEach((fire, i) => {
      if (!ok[i]) return;
      const at = fire.toISOString();
      out.push({
        ...common,
        id: `goal:${r.id}:${at}`,
        kind: 'date',
        at,
        nextAt: at,
        date: logicalDate(fire, settings.dayEndsAt),
      });
    });
  }
  return out;
}

function reviewReminders(input: PlannerInput): PlannedReminder[] {
  const { now, settings } = input;
  const out: PlannedReminder[] = [];
  const localToday = formatDate(now);

  if (settings.reviewNotifications.weekly) {
    const lastDayIso = (((settings.weekStart + 6) % 7) + 6) % 7;
    const probe = localDateTime(localToday, WEEKLY_REVIEW_TIME.hour, WEEKLY_REVIEW_TIME.minute);
    if (!inQuietHours(probe, settings.quietHours)) {
      const next = eachDate(addDaysTo(localToday, 0), addDaysTo(localToday, 7))
        .filter((d) => isoWeekday(d) === lastDayIso)
        .map((d) => localDateTime(d, WEEKLY_REVIEW_TIME.hour, WEEKLY_REVIEW_TIME.minute))
        .find((f) => f.getTime() > now.getTime());
      if (next) {
        out.push({
          id: 'review:weekly',
          kind: 'weekly',
          weekday: lastDayIso,
          hour: WEEKLY_REVIEW_TIME.hour,
          minute: WEEKLY_REVIEW_TIME.minute,
          category: 'review',
          contentKey: 'weeklyReview',
          route: 'review/week',
          priority: 1,
          nextAt: next.toISOString(),
        });
      }
    }
  }

  if (settings.reviewNotifications.monthly) {
    const y = now.getFullYear();
    const m = now.getMonth();
    for (let k = 0; k < 3 && out.filter((o) => o.contentKey === 'monthlyReview').length < 2; k++) {
      const fire = new Date(y, m + k, 1, MONTHLY_REVIEW_TIME.hour, MONTHLY_REVIEW_TIME.minute);
      if (fire.getTime() <= now.getTime() || inQuietHours(fire, settings.quietHours)) continue;
      const at = fire.toISOString();
      out.push({
        id: `review:monthly:${at}`,
        kind: 'date',
        at,
        category: 'review',
        contentKey: 'monthlyReview',
        route: 'review/month',
        priority: 1,
        nextAt: at,
      });
    }
  }
  return out;
}

function backupReminder(input: PlannerInput): PlannedReminder[] {
  const { now, settings } = input;
  const overdue = isBackupOverdue({
    now,
    frequency: settings.backupReminderFrequency,
    lastBackupAt: settings.lastBackupAt,
    earliestGoalCreatedAt: input.earliestGoalCreatedAt,
  });
  if (!overdue) return [];
  const localToday = formatDate(now);
  const fire = [localToday, addDaysTo(localToday, 1)]
    .map((d) => localDateTime(d, BACKUP_REMINDER_TIME.hour, BACKUP_REMINDER_TIME.minute))
    .find((f) => f.getTime() > now.getTime());
  if (!fire || inQuietHours(fire, settings.quietHours)) return [];
  const at = fire.toISOString();
  return [
    { id: `backup:${at}`, kind: 'date', at, category: 'backup', contentKey: 'backupReminder', priority: 2, nextAt: at },
  ];
}

/** Desired notification set: priority class, then next fire time, capped at 64. */
export function planReminders(input: PlannerInput): PlannedReminder[] {
  const all = [...goalReminders(input), ...reviewReminders(input), ...backupReminder(input)];
  all.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.nextAt < b.nextAt ? -1 : a.nextAt > b.nextAt ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return all.slice(0, MAX_PENDING_NOTIFICATIONS);
}
