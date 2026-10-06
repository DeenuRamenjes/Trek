import { createTestDb } from '../../test/testDb';
import type { TrekDb } from '../client';
import * as rows from '../rows';
import { seedDemoData } from '../seed';

const TODAY = '2026-10-05';
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function setup() {
  const t = createTestDb();
  return { db: t.db as unknown as TrekDb, raw: t.raw };
}
const all = (raw: ReturnType<typeof createTestDb>['raw'], table: string) =>
  (raw.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v])),
  );
const count = (raw: ReturnType<typeof createTestDb>['raw'], table: string) =>
  (raw.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

describe('seedDemoData', () => {
  it('inserts the demo data set', async () => {
    const { db, raw } = setup();
    await seedDemoData(db, { today: TODAY });
    expect(count(raw, 'goals')).toBe(12);
    expect(count(raw, 'groups')).toBe(3);
    expect(count(raw, 'vacations')).toBe(2);
    const multi = raw.prepare('SELECT COUNT(*) AS c FROM (SELECT goal_id FROM goal_schedule_versions GROUP BY goal_id HAVING COUNT(*) >= 2)').get() as { c: number };
    expect(multi.c).toBeGreaterThanOrEqual(3);
    expect(count(raw, 'reminders')).toBeGreaterThan(0);
    const types = (raw.prepare('SELECT DISTINCT tracking_type AS t FROM goals').all() as { t: string }[]).map((r) => r.t).sort();
    expect(types).toEqual(['check', 'count', 'duration', 'value']);
    const sched = (raw.prepare('SELECT DISTINCT schedule_type AS t FROM goal_schedule_versions').all() as { t: string }[]).map((r) => r.t).sort();
    expect(sched).toEqual(['customDays', 'daily', 'everyNDays', 'timesPerWeek', 'weekdays', 'weekends']);
    expect(count(raw, 'goal_pauses')).toBe(2);
    expect((raw.prepare('SELECT COUNT(*) AS c FROM goals WHERE archived_at IS NOT NULL').get() as { c: number }).c).toBe(1);
    expect((raw.prepare('SELECT COUNT(*) AS c FROM goals WHERE paused_at IS NOT NULL').get() as { c: number }).c).toBe(1);
    expect((raw.prepare('SELECT COUNT(DISTINCT goal_id) AS c FROM goal_slots gs JOIN goal_schedule_versions v ON v.id = gs.schedule_version_id').get() as { c: number }).c).toBe(2);
  });

  it('logs span three years with valid statuses only', async () => {
    const { db, raw } = setup();
    await seedDemoData(db, { today: TODAY });
    const r = raw.prepare('SELECT MIN(date) AS lo, MAX(date) AS hi FROM logs').get() as { lo: string; hi: string };
    expect(r.lo <= '2023-10-05').toBe(true);
    expect(r.hi >= '2026-10-04').toBe(true);
    const statuses = (raw.prepare('SELECT DISTINCT status AS s FROM logs').all() as { s: string }[]).map((x) => x.s).sort();
    expect(statuses).toEqual(['done', 'partial', 'skipped']);
    expect((raw.prepare('SELECT COUNT(*) AS c FROM logs WHERE note IS NOT NULL').get() as { c: number }).c).toBeGreaterThan(0);
  });

  it('every row passes its zod row schema', async () => {
    const { db, raw } = setup();
    await seedDemoData(db, { today: TODAY });
    const checks: [string, { parse: (v: unknown) => unknown }][] = [
      ['goals', rows.goalRow],
      ['goal_schedule_versions', rows.scheduleVersionRow],
      ['goal_slots', rows.slotRow],
      ['reminders', rows.reminderRow],
      ['groups', rows.groupRow],
      ['group_goals', rows.groupGoalRow],
      ['goal_pauses', rows.goalPauseRow],
      ['logs', rows.logRow],
      ['vacations', rows.vacationRow],
      ['vacation_goals', rows.vacationGoalRow],
    ];
    for (const [table, schema] of checks) {
      for (const row of all(raw, table)) {
        const input = table === 'reminders' ? { ...row, enabled: row.enabled === 1 } : row;
        expect(() => schema.parse(input)).not.toThrow();
      }
    }
  });

  it('is deterministic and re-runnable', async () => {
    const { db, raw } = setup();
    const tables = ['goals', 'goal_schedule_versions', 'goal_slots', 'reminders', 'groups', 'group_goals', 'goal_pauses', 'logs', 'vacations', 'vacation_goals'];
    await seedDemoData(db, { today: TODAY });
    const first = tables.map((t) => count(raw, t));
    const firstLogs = all(raw, 'logs');
    await seedDemoData(db, { today: TODAY });
    expect(tables.map((t) => count(raw, t))).toEqual(first);
    expect(all(raw, 'logs')).toEqual(firstLogs);
  });
});
