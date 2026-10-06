import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../test/testDb';
import * as s from '../schema';

const TS = '2026-10-05T08:00:00.000Z';
const G = '11111111-1111-4111-8111-111111111111';
const V = '22222222-2222-4222-8222-222222222222';

async function seedGoal(db: ReturnType<typeof createTestDb>['db']) {
  await db.insert(s.goals).values({ id: G, name: 'Read', startDate: '2026-10-01', createdAt: TS, updatedAt: TS });
}

const log = (id: string, slotId: string | null) => ({
  id,
  goalId: G,
  date: '2026-10-05',
  slotId,
  value: 1,
  status: 'done' as const,
  loggedAt: TS,
  updatedAt: TS,
});

describe('schema', () => {
  it('applies migrations to an empty db and creates the 11 tables', () => {
    const { raw } = createTestDb();
    const names = (
      raw
        .prepare(
          "select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name",
        )
        .all() as { name: string }[]
    ).map((r) => r.name);
    expect(names).toEqual([
      'goal_pauses',
      'goal_schedule_versions',
      'goal_slots',
      'goals',
      'group_goals',
      'groups',
      'logs',
      'pending_actions',
      'reminders',
      'vacation_goals',
      'vacations',
    ]);
  });

  it('applies column defaults', async () => {
    const { db } = createTestDb();
    await seedGoal(db);
    const [g] = await db.select().from(s.goals);
    expect(g).toMatchObject({
      icon: 'flag',
      color: '#2E7D5B',
      trackingType: 'check',
      targetValue: 1,
      unit: null,
      sortOrder: 0,
    });
  });

  it('rejects duplicate logs for the same goal, date and null slot', async () => {
    const { db } = createTestDb();
    await seedGoal(db);
    await db.insert(s.logs).values(log('a1111111-1111-4111-8111-111111111111', null));
    await expect(db.insert(s.logs).values(log('a2222222-2222-4222-8222-222222222222', null))).rejects.toThrow();
  });

  it('allows the same goal and date with different slots', async () => {
    const { db, raw } = createTestDb();
    await seedGoal(db);
    await db.insert(s.logs).values(log('a1111111-1111-4111-8111-111111111111', 'slot-a'));
    await db.insert(s.logs).values(log('a2222222-2222-4222-8222-222222222222', 'slot-b'));
    await db.insert(s.logs).values(log('a3333333-3333-4333-8333-333333333333', null));
    expect(raw.prepare('select count(*) c from logs').get()).toEqual({ c: 3 });
  });

  it('cascades goal deletion to dependents', async () => {
    const { db, raw } = createTestDb();
    await seedGoal(db);
    const grp = '33333333-3333-4333-8333-333333333333';
    const vac = '44444444-4444-4444-8444-444444444444';
    await db.insert(s.goalScheduleVersions).values({
      id: V, goalId: G, effectiveFrom: '2026-10-01', scheduleType: 'daily', scheduleDays: 127, createdAt: TS,
    });
    await db.insert(s.goalSlots).values({ id: '55555555-5555-4555-8555-555555555555', scheduleVersionId: V, weekday: 1, time: '08:00' });
    await db.insert(s.reminders).values({ id: '66666666-6666-4666-8666-666666666666', goalId: G, weekday: 1, time: '08:00' });
    await db.insert(s.goalPauses).values({ id: '77777777-7777-4777-8777-777777777777', goalId: G, startDate: '2026-10-02', createdAt: TS, updatedAt: TS });
    await db.insert(s.logs).values(log('a1111111-1111-4111-8111-111111111111', null));
    await db.insert(s.groups).values({ id: grp, name: 'G', color: '#2E7D5B', icon: 'flag', createdAt: TS, updatedAt: TS });
    await db.insert(s.groupGoals).values({ groupId: grp, goalId: G });
    await db.insert(s.vacations).values({ id: vac, startDate: '2026-10-10', endDate: '2026-10-12', scope: 'selected', createdAt: TS, updatedAt: TS });
    await db.insert(s.vacationGoals).values({ vacationId: vac, goalId: G });

    await db.delete(s.goals).where(eq(s.goals.id, G));

    for (const t of ['goal_schedule_versions', 'goal_slots', 'reminders', 'goal_pauses', 'logs', 'group_goals', 'vacation_goals']) {
      expect(raw.prepare(`select count(*) c from ${t}`).get()).toEqual({ c: 0 });
    }
    expect(raw.prepare('select count(*) c from groups').get()).toEqual({ c: 1 });
  });

  it('matches the migration snapshot', () => {
    const dir = path.join(__dirname, '..', 'migrations');
    const sqlFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => ({ file: f, sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
    expect(sqlFiles).toMatchSnapshot();
  });
});
