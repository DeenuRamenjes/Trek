import { and, asc, eq, gte, isNull, lte, type SQL } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { emitDbChanged } from '../changes';
import { withTransaction } from '../transaction';
import { newId, nowIso } from '../ids';
import { logs, type Log } from '../schema';

export type LogInput = {
  goalId: string;
  date: string;
  slotId?: string | null;
  value: number;
  status: Log['status'];
  note?: string | null;
};

/** Insert, or update the row for (goalId, date, slotId); null slotId counts as one value. loggedAt stays from the first insert. On update an undefined note keeps the existing one; null clears it. */
export async function upsertLog(db: TrekDb, input: LogInput): Promise<Log> {
  const now = nowIso();
  const slotId = input.slotId ?? null;
  return withTransaction(db, async (tx) => {
    const key = and(
      eq(logs.goalId, input.goalId),
      eq(logs.date, input.date),
      slotId === null ? isNull(logs.slotId) : eq(logs.slotId, slotId),
    );
    const existing = (await tx.select().from(logs).where(key))[0];
    if (existing) {
      await tx
        .update(logs)
        .set({ value: input.value, status: input.status, note: input.note === undefined ? existing.note : input.note, updatedAt: now })
        .where(eq(logs.id, existing.id));
      return (await tx.select().from(logs).where(eq(logs.id, existing.id)))[0];
    }
    const id = newId();
    await tx.insert(logs).values({
      id,
      goalId: input.goalId,
      date: input.date,
      slotId,
      value: input.value,
      status: input.status,
      note: input.note ?? null,
      loggedAt: now,
      updatedAt: now,
    });
    return (await tx.select().from(logs).where(eq(logs.id, id)))[0];
  });
}

export async function deleteLog(db: TrekDb, id: string): Promise<void> {
  await db.delete(logs).where(eq(logs.id, id));
  emitDbChanged();
}

export async function listLogs(db: TrekDb, opts: { goalId?: string; from?: string; to?: string } = {}): Promise<Log[]> {
  const conds: SQL[] = [];
  if (opts.goalId) conds.push(eq(logs.goalId, opts.goalId));
  if (opts.from) conds.push(gte(logs.date, opts.from));
  if (opts.to) conds.push(lte(logs.date, opts.to));
  return db
    .select()
    .from(logs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(logs.date), asc(logs.loggedAt));
}
