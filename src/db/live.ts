import { and, asc, gte, lte, type SQL } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useState } from 'react';
import type { TrekDb } from './client';
import { onDbChanged } from './changes';
import { useDb } from './DbProvider';
import { goals, groups, logs, vacations } from './schema';

export type LiveResult<T> = { data: T[]; error: Error | undefined };

/** True for the expo-sqlite driver, which supports drizzle's useLiveQuery. */
function isExpoDb(db: TrekDb): boolean {
  return typeof (db as unknown as { $client?: { addDatabaseChangeListener?: unknown } }).$client?.addDatabaseChangeListener === 'function';
}

/**
 * Live query. Expo driver: drizzle useLiveQuery. Other drivers (tests): run once, then re-run on dbChanged.
 * The driver is fixed for the lifetime of a db instance, so the branch is stable across renders.
 */
function useLive<T>(db: TrekDb, build: (db: TrekDb) => PromiseLike<T[]>, deps: unknown[]): LiveResult<T> {
  if (isExpoDb(db)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const r = useLiveQuery(build(db) as never, deps) as { data: T[]; error: Error | undefined };
    return { data: r.data, error: r.error };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useFallback(db, build, deps);
}

function useFallback<T>(db: TrekDb, build: (db: TrekDb) => PromiseLike<T[]>, deps: unknown[]): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ data: [], error: undefined });
  useEffect(() => {
    let alive = true;
    const run = () => {
      Promise.resolve(build(db)).then(
        (data) => alive && setState({ data, error: undefined }),
        (error: unknown) => alive && setState((s) => ({ data: s.data, error: error as Error })),
      );
    };
    run();
    const off = onDbChanged(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);
  return state;
}

export function useLiveGoals() {
  const db = useDb();
  return useLive(db, (d) => d.select().from(goals).orderBy(asc(goals.sortOrder), asc(goals.createdAt)), []);
}

/** Logs with date inside the inclusive YYYY-MM-DD range; omitted bounds are open. */
export function useLiveLogs(range: { from?: string; to?: string } = {}) {
  const db = useDb();
  return useLive(
    db,
    (d) => {
      const conds: SQL[] = [];
      if (range.from) conds.push(gte(logs.date, range.from));
      if (range.to) conds.push(lte(logs.date, range.to));
      return d
        .select()
        .from(logs)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(asc(logs.date));
    },
    [range.from, range.to],
  );
}

export function useLiveGroups() {
  const db = useDb();
  return useLive(db, (d) => d.select().from(groups).orderBy(asc(groups.sortOrder), asc(groups.createdAt)), []);
}

export function useLiveVacations() {
  const db = useDb();
  return useLive(db, (d) => d.select().from(vacations).orderBy(asc(vacations.startDate)), []);
}
