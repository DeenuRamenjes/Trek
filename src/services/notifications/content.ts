import { formatDate } from '../../domain/dates';
import type { PlannedReminder } from '../../domain/reminderPlanner';
import { strings } from '../../strings/en';
import { notificationUrl, type NotificationUrlData } from './url';

export type RenderedContent = {
  title: string;
  body: string;
  url: string;
  data: Record<string, unknown>;
};

/**
 * Title/body from the strings file. Never includes notes. While the app lock is on the body is
 * generic (goal name stays only in the title).
 */
export function renderContent(p: PlannedReminder, opts: { appLockEnabled: boolean }): RenderedContent {
  const s = strings.notifications;
  let title: string;
  let body: string;
  let urlData: NotificationUrlData;
  switch (p.contentKey) {
    case 'goalReminder':
      title = p.goalName ?? s.fallbackGoalTitle;
      body = opts.appLockEnabled ? s.genericBody : s.goalBody;
      urlData = { route: 'today' };
      break;
    case 'weeklyReview':
      title = s.weeklyReviewTitle;
      body = s.weeklyReviewBody;
      urlData = { route: 'review/week', date: formatDate(new Date(p.nextAt)) };
      break;
    case 'monthlyReview':
      title = s.monthlyReviewTitle;
      body = s.monthlyReviewBody;
      urlData = { route: 'review/month', date: formatDate(new Date(p.nextAt)) };
      break;
    case 'backupReminder':
      title = s.backupTitle;
      body = s.backupBody;
      urlData = { route: 'backup' };
      break;
  }
  const url = notificationUrl(urlData);
  const data: Record<string, unknown> = { url };
  if (p.goalId) data.goalId = p.goalId;
  return { title, body, url, data };
}
