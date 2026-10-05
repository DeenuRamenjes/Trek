import { z } from 'zod';

const uuid = z.uuid();
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected #RRGGBB');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');
const timestamp = z.iso.datetime({ offset: true });
const weekday = z.number().int().min(0).max(6);
const name = z.string().trim().min(1).max(100);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').refine((s) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}, 'Not a real calendar date');

const endNotBeforeStart = (v: { startDate: string; endDate?: string | null }) =>
  v.endDate == null || v.endDate >= v.startDate;
const endMessage = { message: 'endDate must not be before startDate', path: ['endDate'] };

export const goalRow = z
  .object({
    id: uuid,
    name,
    icon: z.string().min(1),
    color,
    trackingType: z.enum(['check', 'count', 'duration', 'value']),
    targetValue: z.number().int().min(1),
    unit: z.string().nullable().optional(),
    startDate: date,
    endDate: date.nullable().optional(),
    targetDays: z.number().int().min(1).nullable().optional(),
    pausedAt: timestamp.nullable().optional(),
    archivedAt: timestamp.nullable().optional(),
    sortOrder: z.number().int(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(endNotBeforeStart, endMessage);

export const scheduleVersionRow = z
  .object({
    id: uuid,
    goalId: uuid,
    effectiveFrom: date,
    scheduleType: z.enum(['daily', 'weekdays', 'weekends', 'customDays', 'everyNDays', 'timesPerWeek']),
    scheduleDays: z.number().int().min(0).max(127),
    everyNDays: z.number().int().min(2).nullable().optional(),
    timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
    createdAt: timestamp,
  })
  .superRefine((v, ctx) => {
    if (v.scheduleType === 'everyNDays' && v.everyNDays == null) {
      ctx.addIssue({ code: 'custom', message: 'everyNDays is required', path: ['everyNDays'] });
    }
    if (v.scheduleType === 'timesPerWeek' && v.timesPerWeek == null) {
      ctx.addIssue({ code: 'custom', message: 'timesPerWeek is required', path: ['timesPerWeek'] });
    }
  });

export const slotRow = z.object({
  id: uuid,
  scheduleVersionId: uuid,
  weekday,
  time,
  label: z.string().nullable().optional(),
});

export const reminderRow = z.object({
  id: uuid,
  goalId: uuid,
  slotId: uuid.nullable().optional(),
  weekday,
  time,
  offsetMin: z.number().int(),
  enabled: z.boolean(),
});

export const groupRow = z.object({
  id: uuid,
  name,
  color,
  icon: z.string().min(1),
  sortOrder: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const groupGoalRow = z.object({ groupId: uuid, goalId: uuid });

export const goalPauseRow = z
  .object({
    id: uuid,
    goalId: uuid,
    startDate: date,
    endDate: date.nullable().optional(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(endNotBeforeStart, endMessage);

export const logRow = z.object({
  id: uuid,
  goalId: uuid,
  date,
  slotId: uuid.nullable().optional(),
  value: z.number().int().min(0),
  status: z.enum(['done', 'partial', 'skipped']),
  note: z.string().max(1000).nullable().optional(),
  loggedAt: timestamp,
  updatedAt: timestamp,
});

export const vacationRow = z
  .object({
    id: uuid,
    startDate: date,
    endDate: date,
    scope: z.enum(['all', 'selected']),
    note: z.string().max(1000).nullable().optional(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(endNotBeforeStart, endMessage);

export const vacationGoalRow = z.object({ vacationId: uuid, goalId: uuid });

export const pendingActionRow = z.object({
  id: z.string().min(1),
  source: z.enum(['notification', 'widget']),
  goalId: uuid,
  date,
  slotId: uuid.nullable().optional(),
  action: z.enum(['done', 'increment', 'skip', 'snooze']),
  value: z.number().int().nullable().optional(),
  createdAt: timestamp,
  processedAt: timestamp.nullable().optional(),
});
