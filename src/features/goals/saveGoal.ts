import type { TrekDb } from '../../db/client';
import {
  addScheduleVersionTx,
  createGoalTx,
  getGoal,
  listReminders,
  listScheduleVersions,
  listSlots,
  setRemindersTx,
  updateGoalTx,
  type ReminderInput,
} from '../../db/repositories';
import { withTransaction } from '../../db/transaction';
import { effectiveVersion } from '../../domain/scheduleEngine';
import {
  defaultGoalForm,
  goalFormSchema,
  maskToDays,
  scheduleMask,
  type FormState,
  type GoalFormInput,
  type GoalFormValues,
} from './goalFormSchema';

type ScheduleShape = {
  scheduleType: GoalFormValues['scheduleType'];
  scheduleDays: number;
  everyNDays: number | null;
  timesPerWeek: number | null;
};

function scheduleOf(v: GoalFormValues): ScheduleShape {
  return {
    scheduleType: v.scheduleType,
    scheduleDays: scheduleMask(v),
    everyNDays: v.scheduleType === 'everyNDays' ? v.everyNDays : null,
    timesPerWeek: v.scheduleType === 'timesPerWeek' ? v.timesPerWeek : null,
  };
}

type SlotShape = { weekday: number; time: string; label: string | null };

function slotKey(s: SlotShape): string {
  return `${s.weekday}|${s.time}|${s.label ?? ''}`;
}

function sameSchedule(
  a: ScheduleShape,
  aSlots: SlotShape[],
  b: ScheduleShape,
  bSlots: SlotShape[],
): boolean {
  if (a.scheduleType !== b.scheduleType || a.everyNDays !== b.everyNDays || a.timesPerWeek !== b.timesPerWeek) return false;
  // Only customDays reads the mask; the other types derive their days from the type.
  if (a.scheduleType === 'customDays' && a.scheduleDays !== b.scheduleDays) return false;
  const ak = aSlots.map(slotKey).sort();
  const bk = bSlots.map(slotKey).sort();
  return ak.length === bk.length && ak.every((k, i) => k === bk[i]);
}

/**
 * Creates or updates a goal in one transaction. Edits insert a new schedule version effective
 * `today` only when the schedule or its times changed; past versions are never mutated.
 * Returns the goal id. Throws a ZodError when the form is invalid.
 */
export async function saveGoal(db: TrekDb, goalId: string | null, input: GoalFormInput, today: string): Promise<string> {
  const v = goalFormSchema.parse(input);
  const isCheck = v.trackingType === 'check';
  const fields = {
    name: v.name,
    icon: v.icon,
    color: v.color.toUpperCase(),
    trackingType: v.trackingType,
    targetValue: isCheck ? 1 : v.targetValue,
    unit: isCheck || v.unit === '' ? null : v.unit,
    endDate: v.durationMode === 'endDate' ? v.endDate : null,
    targetDays: v.durationMode === 'targetDays' ? v.targetDays : null,
  };
  const schedule = scheduleOf(v);
  const seen = new Set<string>();
  const slots = v.slots
    .filter((s) => !seen.has(`${s.weekday}|${s.time}`) && seen.add(`${s.weekday}|${s.time}`))
    .map((s) => ({ weekday: s.weekday, time: s.time, label: s.label === '' ? null : s.label }));

  return withTransaction(db, async (tx) => {
    let id: string;
    let versionId: string;
    if (goalId === null) {
      const goal = await createGoalTx(tx, { ...fields, startDate: today }, today);
      id = goal.id;
      versionId = (await addScheduleVersionTx(tx, id, goal.startDate, schedule, slots)).id;
    } else {
      id = goalId;
      await updateGoalTx(tx, id, fields);
      const versions = await listScheduleVersions(tx, id);
      const current = effectiveVersion(versions, today) ?? versions[0];
      const currentSlots = current ? await listSlots(tx, current.id) : [];
      if (current && sameSchedule(shapeOf(current), currentSlots, schedule, slots)) {
        versionId = current.id;
      } else {
        versionId = (await addScheduleVersionTx(tx, id, today, schedule, slots)).id;
      }
    }

    // Slot ids change with a new version, so reminders are rebuilt against the version in force.
    const slotRows = await listSlots(tx, versionId);
    await setRemindersTx(tx, id, v.reminderEnabled ? buildReminders(v, slotRows) : []);
    return id;
  });
}

function shapeOf(v: { scheduleType: ScheduleShape['scheduleType']; scheduleDays: number; everyNDays: number | null; timesPerWeek: number | null }): ScheduleShape {
  return { scheduleType: v.scheduleType, scheduleDays: v.scheduleDays, everyNDays: v.everyNDays, timesPerWeek: v.timesPerWeek };
}

function buildReminders(v: GoalFormValues, slotRows: { id: string; weekday: number; time: string }[]): ReminderInput[] {
  const out: ReminderInput[] = [];
  for (const weekday of [...v.reminderWeekdays].sort()) {
    const daySlots = slotRows.filter((s) => s.weekday === weekday);
    if (daySlots.length > 0) {
      for (const s of daySlots) out.push({ weekday, time: s.time, slotId: s.id, offsetMin: -v.minutesBefore });
    } else {
      out.push({ weekday, time: v.reminderTime, offsetMin: -v.minutesBefore });
    }
  }
  return out;
}

/** Form state for editing a goal, from the schedule version in force on `today`. Undefined when the goal is missing. */
export async function loadGoalFormValues(db: TrekDb, goalId: string, today: string): Promise<FormState | undefined> {
  const goal = await getGoal(db, goalId);
  if (!goal) return undefined;
  const versions = await listScheduleVersions(db, goalId);
  // listScheduleVersions is ordered by effectiveFrom, so versions[0] is the earliest (the right pick when only future versions exist).
  const current = effectiveVersion(versions, today) ?? versions[0];
  const slots = current ? await listSlots(db, current.id) : [];
  const rems = (await listReminders(db, goalId)).filter((r) => r.enabled);
  const base = defaultGoalForm(goal.color);
  const slotless = rems.find((r) => r.slotId === null);
  return {
    ...base,
    name: goal.name,
    icon: goal.icon,
    trackingType: goal.trackingType,
    targetValue: String(goal.targetValue),
    unit: goal.unit ?? '',
    scheduleType: current?.scheduleType ?? 'daily',
    days: current?.scheduleType === 'customDays' ? maskToDays(current.scheduleDays) : [],
    everyNDays: String(current?.everyNDays ?? 2),
    timesPerWeek: String(current?.timesPerWeek ?? 3),
    slots: slots.map((s) => ({ weekday: s.weekday, time: s.time, label: s.label ?? '' })),
    durationMode: goal.endDate ? 'endDate' : goal.targetDays ? 'targetDays' : 'open',
    endDate: goal.endDate ?? '',
    targetDays: String(goal.targetDays ?? 30),
    reminderEnabled: rems.length > 0,
    reminderWeekdays: rems.length > 0 ? [...new Set(rems.map((r) => r.weekday))].sort() : base.reminderWeekdays,
    reminderTime: slotless?.time ?? base.reminderTime,
    minutesBefore: rems.length > 0 ? Math.min(120, Math.max(0, -rems[0].offsetMin)) : 0,
  };
}
