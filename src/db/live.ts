import { and, asc, gte, lte, type SQL } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { getDb } from './client';
import { goals, groups, logs, vacations } from './schema';

export function useLiveGoals() {
  return useLiveQuery(getDb().select().from(goals).orderBy(asc(goals.sortOrder), asc(goals.createdAt)));
}

/** Logs with date inside the inclusive YYYY-MM-DD range; omitted bounds are open. */
export function useLiveLogs(range: { from?: string; to?: string } = {}) {
  const conds: SQL[] = [];
  if (range.from) conds.push(gte(logs.date, range.from));
  if (range.to) conds.push(lte(logs.date, range.to));
  return useLiveQuery(
    getDb()
      .select()
      .from(logs)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(logs.date)),
    [range.from, range.to],
  );
}

export function useLiveGroups() {
  return useLiveQuery(getDb().select().from(groups).orderBy(asc(groups.sortOrder), asc(groups.createdAt)));
}

export function useLiveVacations() {
  return useLiveQuery(getDb().select().from(vacations).orderBy(asc(vacations.startDate)));
}
