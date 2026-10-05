import type { GoalIconName } from '../ui/icons';
import type { StatusKey } from '../ui/tokens';

/** Static mock data for the dev-only design preview. Not used by the real app. */

export type PreviewGoal = {
  id: string;
  name: string;
  icon: GoalIconName;
  color: string;
  kind: 'check' | 'count' | 'duration' | 'value';
  status: StatusKey;
  progressLabel: string;
  slots?: { time: string; done: boolean }[];
  weekly?: { done: number; target: number };
};

export const previewToday = {
  dateLabel: 'Monday, 5 October',
  selectedKey: '2026-10-05',
  strip: [
    { key: '2026-09-29', weekday: 'Tue', day: 29 },
    { key: '2026-09-30', weekday: 'Wed', day: 30 },
    { key: '2026-10-01', weekday: 'Thu', day: 1 },
    { key: '2026-10-02', weekday: 'Fri', day: 2 },
    { key: '2026-10-03', weekday: 'Sat', day: 3 },
    { key: '2026-10-04', weekday: 'Sun', day: 4 },
    { key: '2026-10-05', weekday: 'Mon', day: 5 },
  ],
  backupDays: 9,
  pending: [
    { id: 'g1', name: 'Water', icon: 'water', color: '#2F6FB0', kind: 'count', status: 'pending', progressLabel: '5 / 8 glasses' },
    {
      id: 'g2',
      name: 'Vitamins',
      icon: 'medkit',
      color: '#B23A7A',
      kind: 'check',
      status: 'partial',
      progressLabel: '1 of 2',
      slots: [
        { time: '08:00', done: true },
        { time: '21:00', done: false },
      ],
    },
    {
      id: 'g3',
      name: 'Workout',
      icon: 'barbell',
      color: '#C0392B',
      kind: 'check',
      status: 'pending',
      progressLabel: '',
      weekly: { done: 2, target: 3 },
    },
    { id: 'g4', name: 'Meditation', icon: 'flower', color: '#7A4FC2', kind: 'duration', status: 'pending', progressLabel: '0 / 10 min' },
  ] satisfies PreviewGoal[],
  done: [
    { id: 'g5', name: 'Reading', icon: 'book', color: '#2E7D5B', kind: 'value', status: 'done', progressLabel: '20 / 20 pages' },
  ] satisfies PreviewGoal[],
};

export const previewStats = {
  groupLabel: 'All goals',
  completion: 0.78,
  currentStreak: 12,
  bestStreak: 31,
  /** 12 weeks x 7 days, 0..1 completion per day, oldest first. */
  heatmap: Array.from({ length: 84 }, (_, i) => ((i * 37) % 100) / 100),
  weekly: [
    { label: 'W33', value: 0.62 },
    { label: 'W34', value: 0.7 },
    { label: 'W35', value: 0.66 },
    { label: 'W36', value: 0.81 },
    { label: 'W37', value: 0.74 },
    { label: 'W38', value: 0.88 },
    { label: 'W39', value: 0.79 },
    { label: 'W40', value: 0.84 },
  ],
  trend: [0.55, 0.6, 0.58, 0.66, 0.7, 0.68, 0.74, 0.77, 0.75, 0.8, 0.79, 0.84],
  perGoal: [
    { name: 'Reading', color: '#2E7D5B', value: 0.92 },
    { name: 'Water', color: '#2F6FB0', value: 0.81 },
    { name: 'Meditation', color: '#7A4FC2', value: 0.64 },
    { name: 'Workout', color: '#C0392B', value: 0.58 },
  ],
  weekdays: [
    { label: 'Mon', value: 0.74 },
    { label: 'Tue', value: 0.91 },
    { label: 'Wed', value: 0.8 },
    { label: 'Thu', value: 0.77 },
    { label: 'Fri', value: 0.69 },
    { label: 'Sat', value: 0.62 },
    { label: 'Sun', value: 0.71 },
  ],
  bestWeekday: 'Tuesday',
};

export type PreviewHistoryDay = { day: number; status: StatusKey; value?: string };

const historyStatuses: StatusKey[] = ['done', 'done', 'partial', 'done', 'skipped', 'done', 'missed'];

export const previewHistory = {
  goalName: 'Reading',
  monthLabel: 'October 2026',
  weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  /** 1 October 2026 is a Thursday; with weeks starting Monday there are 3 blank cells. */
  leadingBlanks: 3,
  days: Array.from({ length: 31 }, (_, i): PreviewHistoryDay => {
    const day = i + 1;
    if (day > 5) return { day, status: 'notDue' };
    if (day === 5) return { day, status: 'pending', value: '0' };
    if (day === 4) return { day, status: 'vacation' };
    const status = historyStatuses[i % historyStatuses.length];
    return { day, status, value: status === 'done' ? '20' : status === 'partial' ? '12' : undefined };
  }),
  currentStreak: 12,
  bestStreak: 31,
  monthCompletion: 0.75,
  sheet: { dateLabel: 'Saturday, 3 October', status: 'partial' as StatusKey, value: '12 / 20 pages', note: 'Finished chapter 4' },
};

export const previewReview = {
  weekNumber: 40,
  overall: 82,
  change: 6,
  perGoal: [
    { name: 'Reading', color: '#2E7D5B', value: 1 },
    { name: 'Water', color: '#2F6FB0', value: 0.86 },
    { name: 'Meditation', color: '#7A4FC2', value: 0.71 },
    { name: 'Workout', color: '#C0392B', value: 0.67 },
  ],
  best: { name: 'Reading', value: 100 },
  worst: { name: 'Workout', value: 67 },
  streaksGained: 3,
  streaksLost: 1,
  bestWeekday: 'Tuesday',
  bestSlot: 'Morning',
  totals: { done: 38, skipped: 3, vacation: 2 },
  insights: ['Reading improved 20% vs last week.', 'Tuesday was your best day.', 'Water reached a 12-day streak.'],
};

export const previewCreateGoal = {
  name: 'Read 20 pages',
  templates: ['water', 'workout', 'reading', 'meditation'] as const,
  weekdays: [
    { label: 'Mon', on: true },
    { label: 'Tue', on: true },
    { label: 'Wed', on: true },
    { label: 'Thu', on: true },
    { label: 'Fri', on: true },
    { label: 'Sat', on: false },
    { label: 'Sun', on: false },
  ],
  selectedColorIndex: 0,
  selectedIcon: 'book' as GoalIconName,
};

export const previewSettings = {
  appearance: [
    { key: 'theme', value: 'System' },
    { key: 'accent', value: 'Trek green' },
    { key: 'weekStart', value: 'Monday' },
    { key: 'timeFormat', value: '24-hour' },
    { key: 'dayEndsAt', value: 'Midnight' },
    { key: 'haptics', value: 'On' },
    { key: 'reduceMotion', value: 'System' },
  ] as const,
};
