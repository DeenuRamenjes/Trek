import { z } from 'zod';
import { strings } from '../../strings/en';

const e = strings.goalForm.errors;

export const DEFAULT_GOAL_COLOR = '#2E7D5B';
export const DEFAULT_GOAL_ICON = 'flag';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTime(value: string): boolean {
  return HHMM.test(value);
}

export function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

const time = z.string().regex(HHMM, e.timeInvalid);
const weekday = z.number().int().min(0).max(6);
const positiveInt = z
  .string()
  .regex(/^\d+$/, e.daysInvalid)
  .transform(Number)
  .pipe(z.number().int().min(1, e.daysInvalid));

export const scheduleTypes = ['daily', 'weekdays', 'weekends', 'customDays', 'everyNDays', 'timesPerWeek'] as const;
export type ScheduleType = (typeof scheduleTypes)[number];
export const trackingTypes = ['check', 'count', 'duration', 'value'] as const;
export const durationModes = ['open', 'endDate', 'targetDays'] as const;

export const slotSchema = z.object({
  weekday,
  time,
  label: z.string().trim().max(60).default(''),
});

/** Form input: text-entry fields are strings; the parsed output holds the typed values. */
export const goalFormSchema = z
  .object({
    name: z.string().trim().min(1, e.nameRequired).max(80),
    icon: z.string().min(1).default(DEFAULT_GOAL_ICON),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, e.colorInvalid).default(DEFAULT_GOAL_COLOR),
    trackingType: z.enum(trackingTypes).default('check'),
    targetValue: z
      .string()
      .transform((v) => Number(v.trim().replace(',', '.')))
      .pipe(z.number({ error: e.targetInvalid }).positive(e.targetInvalid))
      .prefault('1'),
    unit: z.string().trim().max(24).default(''),
    scheduleType: z.enum(scheduleTypes).default('daily'),
    /** ISO weekdays (0 = Monday) used by customDays. */
    days: z.array(weekday).default([]),
    everyNDays: positiveInt.prefault('2'),
    timesPerWeek: positiveInt.pipe(z.number().max(7, e.daysInvalid)).prefault('3'),
    slots: z.array(slotSchema).default([]),
    durationMode: z.enum(durationModes).default('open'),
    endDate: z.string().default(''),
    targetDays: positiveInt.prefault('30'),
    reminderEnabled: z.boolean().default(false),
    reminderWeekdays: z.array(weekday).default([0, 1, 2, 3, 4, 5, 6]),
    reminderTime: time.default('09:00'),
    /** Minutes before the slot or reminder time. */
    minutesBefore: z.number().int().min(0).max(120).default(0),
  })
  .superRefine((v, ctx) => {
    if (v.scheduleType === 'customDays' && v.days.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: strings.goalForm.daysRequired });
    }
    if (v.durationMode === 'endDate' && !isValidDate(v.endDate)) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: e.dateInvalid });
    }
  });

export type GoalFormInput = z.input<typeof goalFormSchema>;
export type GoalFormValues = z.output<typeof goalFormSchema>;

/** Complete form state: every field present, slot labels always strings. */
export type FormState = Omit<Required<GoalFormInput>, 'slots'> & {
  slots: { weekday: number; time: string; label: string }[];
};

/** Complete form state for a new goal. Only the name is required, so it starts empty. */
export function defaultGoalForm(color: string = DEFAULT_GOAL_COLOR): FormState {
  return {
    name: '',
    icon: DEFAULT_GOAL_ICON,
    color,
    trackingType: 'check',
    targetValue: '1',
    unit: '',
    scheduleType: 'daily',
    days: [],
    everyNDays: '2',
    timesPerWeek: '3',
    slots: [],
    durationMode: 'open',
    endDate: '',
    targetDays: '30',
    reminderEnabled: false,
    reminderWeekdays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '09:00',
    minutesBefore: 0,
  };
}

/** ISO weekday bitmask stored on a schedule version. */
export function scheduleMask(values: Pick<GoalFormValues, 'scheduleType' | 'days'>): number {
  switch (values.scheduleType) {
    case 'weekdays':
      return 0b0011111;
    case 'weekends':
      return 0b1100000;
    case 'customDays':
      return values.days.reduce((mask, d) => mask | (1 << d), 0);
    default:
      return 127;
  }
}

export function maskToDays(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => (mask & (1 << d)) !== 0);
}
