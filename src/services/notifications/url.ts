export type NotificationUrlData = {
  route?: 'review/week' | 'review/month' | 'backup' | 'today';
  /** ISO date (week) or date/month string (month) the review refers to. */
  date?: string;
};

/** Deep link for a notification; goal reminders and unknown data open Today. */
export function notificationUrl(data: NotificationUrlData | null | undefined): string {
  if (data?.route === 'review/week' && data.date) return `trek://review/week-${data.date.slice(0, 10)}`;
  if (data?.route === 'review/month' && data.date) return `trek://review/month-${data.date.slice(0, 7)}`;
  if (data?.route === 'backup') return 'trek://settings';
  return 'trek://today';
}
