import { seedDemoData } from '../../../db/seed';
import type { TrekDb } from '../../../db/client';
import { listGroups, listLogs } from '../../../db/repositories';
import { createTestDb } from '../../../test/testDb';
import { loadGoalContexts } from '../../goals/goalContexts';
import type { StatsMode, StatsRange } from '../../../domain/statsCalculator';
import { buildStatsModel } from '../statsModel';
import { buildStatsModelLegacy } from './legacyStatsModel';

const today = '2026-10-05';
const ranges: StatsRange[] = ['7D', '30D', '90D', '1Y', 'All'];
const modes: StatsMode[] = ['weighted', 'strict'];

describe('stats model on the 3-year seed', () => {
  let contexts: Awaited<ReturnType<typeof loadGoalContexts>>;
  let logs: Awaited<ReturnType<typeof listLogs>>;
  let groupGoalIds: string[];

  beforeAll(async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await seedDemoData(db, { today });
    contexts = await loadGoalContexts(db);
    logs = await listLogs(db);
    const groups = (await listGroups(db)) as unknown as { goalIds?: string[] }[];
    groupGoalIds = groups[0]?.goalIds?.length ? groups[0].goalIds : contexts.slice(0, 4).map((c) => c.goal.id);
  });

  const filters: [string, () => string[] | null][] = [
    ['all goals', () => null],
    ['one group', () => groupGoalIds],
  ];

  for (const range of ranges) {
    for (const mode of modes) {
      for (const [label, ids] of filters) {
        it(`matches legacy: ${range} ${mode} ${label}`, () => {
          const input = { contexts, logs, goalIds: ids(), range, mode, today, weekStart: 1 };
          expect(buildStatsModel(input)).toEqual(buildStatsModelLegacy(input));
        });
      }
    }
  }

  it('All range builds fast', () => {
    const input = { contexts, logs, goalIds: null, range: 'All' as const, mode: 'weighted' as const, today, weekStart: 1 };
    const t0 = performance.now();
    buildStatsModel(input);
    const ms = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`stats All range: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1500);
  });
});
