import type { TrekDb } from './client';
import { addDaysToDate } from './dates';
import { withTransaction } from './transaction';
import {
  goalPauses,
  goalScheduleVersions,
  goalSlots,
  goals,
  groupGoals,
  groups,
  logs,
  pendingActions,
  reminders,
  vacationGoals,
  vacations,
} from './schema';

export type SeedOptions = { today: string; random?: () => number };

/** Small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tracking = 'check' | 'count' | 'duration' | 'value';
type ScheduleType = 'daily' | 'weekdays' | 'weekends' | 'customDays' | 'everyNDays' | 'timesPerWeek';
type VersionSpec = { from: string; type: ScheduleType; mask: number; everyN?: number; perWeek?: number };
type GoalSpec = {
  key: string;
  name: string;
  icon: string;
  color: string;
  tracking: Tracking;
  target: number;
  unit?: string;
  start: string;
  versions: VersionSpec[];
  slots?: { weekdays: number[]; time: string; label: string }[];
};

const bit = (...days: number[]) => days.reduce((m, d) => m | (1 << d), 0);
const ALL = 127;
const WEEKDAYS = bit(1, 2, 3, 4, 5);
const WEEKEND = bit(0, 6);

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
const yearsBack = (date: string, years: number) => {
  const y = Number(date.slice(0, 4)) - years;
  const md = date.slice(5);
  return `${y}-${md === '02-29' ? '02-28' : md}`;
};

function makeId(random: () => number): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(random() * 4)]}${hex(3)}-${hex(12)}`;
}

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** Clears every table and inserts demo data in one transaction. Deterministic for a fixed `today` and `random`. */
export async function seedDemoData(db: TrekDb, opts: SeedOptions): Promise<void> {
  const { today } = opts;
  const random = opts.random ?? mulberry32(42);
  const id = () => makeId(random);
  const ts = (date: string) => `${date}T08:00:00.000Z`;
  const start3y = yearsBack(today, 3);
  const ago = (days: number) => addDaysToDate(today, -days);

  const specs: GoalSpec[] = [
    { key: 'water', name: 'Water', icon: 'water', color: '#2563EB', tracking: 'count', target: 8, unit: 'glasses', start: start3y, versions: [{ from: start3y, type: 'daily', mask: ALL }] },
    {
      key: 'workout', name: 'Workout', icon: 'barbell', color: '#C2410C', tracking: 'check', target: 1, start: start3y,
      versions: [
        { from: start3y, type: 'customDays', mask: bit(1, 3, 5) },
        { from: ago(200), type: 'customDays', mask: bit(1, 2, 4, 5) },
      ],
    },
    {
      key: 'reading', name: 'Reading', icon: 'book', color: '#7C3AED', tracking: 'duration', target: 20, unit: 'min', start: start3y,
      versions: [
        { from: start3y, type: 'daily', mask: ALL },
        { from: ago(400), type: 'weekdays', mask: WEEKDAYS },
      ],
    },
    {
      key: 'meditation', name: 'Meditation', icon: 'flower', color: '#0F766E', tracking: 'check', target: 1, start: start3y,
      versions: [{ from: start3y, type: 'daily', mask: ALL }],
      slots: [
        { weekdays: [0, 1, 2, 3, 4, 5, 6], time: '07:00', label: 'Morning' },
        { weekdays: [0, 1, 2, 3, 4, 5, 6], time: '21:00', label: 'Evening' },
      ],
    },
    {
      key: 'vitamins', name: 'Vitamins', icon: 'medkit', color: '#BE185D', tracking: 'check', target: 1, start: ago(900),
      versions: [{ from: ago(900), type: 'weekdays', mask: WEEKDAYS }],
      slots: [
        { weekdays: [1, 2, 3, 4, 5], time: '08:00', label: 'Morning' },
        { weekdays: [1, 2, 3, 4, 5], time: '20:00', label: 'Evening' },
      ],
    },
    { key: 'journal', name: 'Journal', icon: 'heart', color: '#B45309', tracking: 'check', target: 1, start: ago(800), versions: [{ from: ago(800), type: 'weekdays', mask: WEEKDAYS }] },
    { key: 'walk', name: 'Long walk', icon: 'walk', color: '#15803D', tracking: 'duration', target: 60, unit: 'min', start: start3y, versions: [{ from: start3y, type: 'weekends', mask: WEEKEND }] },
    { key: 'stretch', name: 'Stretch', icon: 'fitness', color: '#4338CA', tracking: 'duration', target: 15, unit: 'min', start: ago(1000), versions: [{ from: ago(1000), type: 'customDays', mask: bit(2, 4, 6) }] },
    { key: 'clean', name: 'Clean room', icon: 'nutrition', color: '#475569', tracking: 'check', target: 1, start: start3y, versions: [{ from: start3y, type: 'everyNDays', mask: ALL, everyN: 3 }] },
    { key: 'save', name: 'Save money', icon: 'footsteps', color: '#047857', tracking: 'value', target: 20, unit: 'USD', start: ago(500), versions: [{ from: ago(500), type: 'everyNDays', mask: ALL, everyN: 2 }] },
    {
      key: 'run', name: 'Run', icon: 'bicycle', color: '#DC2626', tracking: 'check', target: 1, start: ago(900),
      versions: [
        { from: ago(900), type: 'timesPerWeek', mask: ALL, perWeek: 3 },
        { from: ago(120), type: 'timesPerWeek', mask: ALL, perWeek: 4 },
      ],
    },
    { key: 'language', name: 'Language', icon: 'language', color: '#0369A1', tracking: 'duration', target: 30, unit: 'min', start: ago(700), versions: [{ from: ago(700), type: 'timesPerWeek', mask: ALL, perWeek: 4 }] },
  ];

  // Pauses, archive and vacations (dates relative to today).
  const archivedKey = 'clean';
  const archiveDate = ago(90);
  const pausedKey = 'stretch';
  const pauses = [
    { start: ago(200), end: ago(171) },
    { start: ago(5), end: null as string | null },
  ];
  const vacationSpecs = [
    { start: ago(300), end: ago(286), scope: 'all' as const, goalKeys: [] as string[], note: 'Summer trip' },
    { start: addDaysToDate(today, 10), end: addDaysToDate(today, 17), scope: 'selected' as const, goalKeys: ['water', 'reading', 'run'], note: null },
  ];
  const groupSpecs = [
    { name: 'Health', color: '#15803D', icon: 'heart', keys: ['water', 'workout', 'run', 'meditation', 'vitamins'] },
    { name: 'Mind', color: '#7C3AED', icon: 'book', keys: ['reading', 'meditation', 'journal', 'language'] },
    { name: 'Life', color: '#B45309', icon: 'leaf', keys: ['clean', 'save', 'walk', 'stretch'] },
  ];

  const goalIds = new Map<string, string>();
  const goalRows: (typeof goals.$inferInsert)[] = [];
  const versionRows: (typeof goalScheduleVersions.$inferInsert)[] = [];
  const slotRows: (typeof goalSlots.$inferInsert)[] = [];
  const reminderRows: (typeof reminders.$inferInsert)[] = [];
  const pauseRows: (typeof goalPauses.$inferInsert)[] = [];
  const logRows: (typeof logs.$inferInsert)[] = [];

  const versionsOf = new Map<string, { spec: VersionSpec; id: string; slots: { id: string; weekday: number; time: string }[] }[]>();

  specs.forEach((s, i) => {
    const gid = id();
    goalIds.set(s.key, gid);
    goalRows.push({
      id: gid,
      name: s.name,
      icon: s.icon,
      color: s.color,
      trackingType: s.tracking,
      targetValue: s.target,
      unit: s.unit ?? null,
      startDate: s.start,
      endDate: null,
      targetDays: null,
      pausedAt: s.key === pausedKey ? `${ago(5)}T08:00:00.000Z` : null,
      archivedAt: s.key === archivedKey ? `${archiveDate}T08:00:00.000Z` : null,
      sortOrder: i,
      createdAt: ts(s.start),
      updatedAt: ts(s.start),
    });
    const vs = s.versions.map((spec, vi) => {
      const vid = id();
      const slotsForVersion: { id: string; weekday: number; time: string }[] = [];
      if (vi === 0 && s.slots) {
        for (const slot of s.slots) {
          for (const weekday of slot.weekdays) {
            const sid = id();
            slotsForVersion.push({ id: sid, weekday, time: slot.time });
            slotRows.push({ id: sid, scheduleVersionId: vid, weekday, time: slot.time, label: slot.label });
          }
        }
      }
      versionRows.push({
        id: vid,
        goalId: gid,
        effectiveFrom: spec.from,
        scheduleType: spec.type,
        scheduleDays: spec.mask,
        everyNDays: spec.everyN ?? null,
        timesPerWeek: spec.perWeek ?? null,
        createdAt: ts(spec.from),
      });
      return { spec, id: vid, slots: slotsForVersion };
    });
    versionsOf.set(s.key, vs);
    if (s.key === pausedKey) {
      for (const p of pauses) {
        pauseRows.push({ id: id(), goalId: gid, startDate: p.start, endDate: p.end, createdAt: ts(p.start), updatedAt: ts(p.start) });
      }
    }
  });

  // Reminders on four goals.
  const remindAt = (key: string, weekdays: number[], time: string, useSlot?: string) => {
    const gid = goalIds.get(key) as string;
    const first = (versionsOf.get(key) as { slots: { id: string; weekday: number; time: string }[] }[])[0];
    for (const weekday of weekdays) {
      const slot = useSlot ? first.slots.find((x) => x.weekday === weekday && x.time === useSlot) : undefined;
      reminderRows.push({ id: id(), goalId: gid, slotId: slot?.id ?? null, weekday, time, offsetMin: 0, enabled: true });
    }
  };
  remindAt('water', [0, 1, 2, 3, 4, 5, 6], '10:00');
  remindAt('workout', [1, 2, 4, 5], '18:00');
  remindAt('meditation', [0, 1, 2, 3, 4, 5, 6], '07:00', '07:00');
  remindAt('reading', [1, 2, 3, 4, 5], '20:30');

  const vacationRanges = vacationSpecs.map((v) => ({
    ...v,
    keys: v.scope === 'all' ? new Set(specs.map((s) => s.key)) : new Set(v.goalKeys),
  }));

  // Logs: due days only, no "missed" rows, nothing inside pauses/vacations or after archiving.
  for (const s of specs) {
    const gid = goalIds.get(s.key) as string;
    const vs = versionsOf.get(s.key) as { spec: VersionSpec; id: string; slots: { id: string; weekday: number; time: string }[] }[];
    for (let date = s.start; date <= today; date = addDaysToDate(date, 1)) {
      if (s.key === archivedKey && date >= archiveDate) break;
      if (s.key === pausedKey && pauses.some((p) => date >= p.start && (p.end === null || date <= p.end))) continue;
      if (vacationRanges.some((v) => v.keys.has(s.key) && date >= v.start && date <= v.end)) continue;
      const v = [...vs].reverse().find((x) => x.spec.from <= date) ?? vs[0];
      const wd = weekdayOf(date);
      const spec = v.spec;
      let due: boolean;
      let chance = 1;
      if (spec.type === 'everyNDays') due = (dayNumber(date) - dayNumber(spec.from)) % (spec.everyN as number) === 0;
      else if (spec.type === 'timesPerWeek') {
        due = true; // any day can count; unlogged days are neutral
        chance = (spec.perWeek as number) / 7;
      } else due = (spec.mask & (1 << wd)) !== 0;
      if (!due) continue;
      const forced = s.key === 'water' && (date === s.start || date === today);
      if (!forced && random() >= chance) continue;

      const note = random() < 0.015 ? 'Felt good today' : null;
      const base = { goalId: gid, date, loggedAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z` };
      const slotsToday = v.slots.filter((x) => x.weekday === wd);
      if (slotsToday.length) {
        slotsToday.forEach((slot, si) => {
          const r = random();
          if (r < 0.75) logRows.push({ id: id(), ...base, slotId: slot.id, value: 1, status: 'done', note: si === 0 ? note : null });
          else if (r < 0.8) logRows.push({ id: id(), ...base, slotId: slot.id, value: 0, status: 'skipped', note: null });
        });
        continue;
      }
      const r = forced ? 0 : random();
      if (r < 0.75) logRows.push({ id: id(), ...base, slotId: null, value: s.target, status: 'done', note });
      else if (r < 0.88 && s.tracking !== 'check') {
        logRows.push({ id: id(), ...base, slotId: null, value: 1 + Math.floor(random() * (s.target - 1)), status: 'partial', note });
      } else if (r < 0.93) logRows.push({ id: id(), ...base, slotId: null, value: 0, status: 'skipped', note });
      // otherwise: no log, the day computes as missed
    }
  }

  const groupRows = groupSpecs.map((g, i) => ({ id: id(), name: g.name, color: g.color, icon: g.icon, sortOrder: i, createdAt: ts(start3y), updatedAt: ts(start3y), keys: g.keys }));
  const vacationRows = vacationRanges.map((v) => ({ id: id(), startDate: v.start, endDate: v.end, scope: v.scope, note: v.note, createdAt: ts(v.start), updatedAt: ts(v.start), keys: [...v.keys] }));

  await withTransaction(db, async (tx) => {
    // Children first so the clear does not depend on cascade settings.
    for (const t of [pendingActions, logs, goalPauses, reminders, goalSlots, goalScheduleVersions, groupGoals, vacationGoals, groups, vacations, goals]) {
      await tx.delete(t);
    }
    await tx.insert(goals).values(goalRows);
    await tx.insert(goalScheduleVersions).values(versionRows);
    await tx.insert(goalSlots).values(slotRows);
    await tx.insert(reminders).values(reminderRows);
    await tx.insert(goalPauses).values(pauseRows);
    await tx.insert(groups).values(groupRows.map(({ keys: _k, ...g }) => g));
    await tx.insert(groupGoals).values(groupRows.flatMap((g) => g.keys.map((k) => ({ groupId: g.id, goalId: goalIds.get(k) as string }))));
    await tx.insert(vacations).values(vacationRows.map(({ keys: _k, ...v }) => v));
    const vacLinks = vacationRows.filter((v) => v.scope === 'selected').flatMap((v) => v.keys.map((k) => ({ vacationId: v.id, goalId: goalIds.get(k) as string })));
    if (vacLinks.length) await tx.insert(vacationGoals).values(vacLinks);
    for (const part of chunks(logRows, 100)) await tx.insert(logs).values(part);
  });
}
