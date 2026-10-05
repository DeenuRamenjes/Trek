import { and, asc, eq } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { withTransaction } from '../transaction';
import { newId, nowIso } from '../ids';
import { goalScheduleVersions, goalSlots, logs, type ScheduleVersion, type Slot } from '../schema';

export type ScheduleVersionInput = Pick<ScheduleVersion, 'scheduleType' | 'scheduleDays'> &
  Partial<Pick<ScheduleVersion, 'everyNDays' | 'timesPerWeek'>>;
export type SlotInput = Pick<Slot, 'weekday' | 'time'> & Partial<Pick<Slot, 'label'>>;

/**
 * Inserts a new schedule version. A version with the same effectiveFrom is not yet in the past,
 * so it is replaced (with its slots) instead of duplicated. Other versions are never touched.
 */
export async function addScheduleVersion(
  db: TrekDb,
  goalId: string,
  effectiveFrom: string,
  version: ScheduleVersionInput,
  slots: SlotInput[] = [],
): Promise<ScheduleVersion> {
  return withTransaction(db, (tx) => addScheduleVersionTx(tx, goalId, effectiveFrom, version, slots));
}

/** addScheduleVersion without its own transaction; call only inside an open withTransaction. */
export async function addScheduleVersionTx(
  tx: TrekDb,
  goalId: string,
  effectiveFrom: string,
  version: ScheduleVersionInput,
  slots: SlotInput[] = [],
): Promise<ScheduleVersion> {
  const replaced = await tx
    .select()
    .from(goalScheduleVersions)
    .where(and(eq(goalScheduleVersions.goalId, goalId), eq(goalScheduleVersions.effectiveFrom, effectiveFrom)));
  const oldSlots: Slot[] = [];
  for (const r of replaced) oldSlots.push(...(await tx.select().from(goalSlots).where(eq(goalSlots.scheduleVersionId, r.id))));
  await tx
    .delete(goalScheduleVersions)
    .where(and(eq(goalScheduleVersions.goalId, goalId), eq(goalScheduleVersions.effectiveFrom, effectiveFrom)));
  const id = newId();
  await tx.insert(goalScheduleVersions).values({
    id,
    goalId,
    effectiveFrom,
    scheduleType: version.scheduleType,
    scheduleDays: version.scheduleDays,
    everyNDays: version.everyNDays ?? null,
    timesPerWeek: version.timesPerWeek ?? null,
    createdAt: nowIso(),
  });
  for (const s of slots) {
    const slotId = newId();
    await tx.insert(goalSlots).values({ id: slotId, scheduleVersionId: id, weekday: s.weekday, time: s.time, label: s.label ?? null });
    // A replaced same-day version must not orphan logs: carry them to the slot with the same weekday and time.
    for (const old of oldSlots.filter((o) => o.weekday === s.weekday && o.time === s.time)) {
      await tx.update(logs).set({ slotId }).where(and(eq(logs.goalId, goalId), eq(logs.slotId, old.id)));
    }
  }
  return (await tx.select().from(goalScheduleVersions).where(eq(goalScheduleVersions.id, id)))[0];
}

export async function listScheduleVersions(db: TrekDb, goalId: string): Promise<ScheduleVersion[]> {
  return db
    .select()
    .from(goalScheduleVersions)
    .where(eq(goalScheduleVersions.goalId, goalId))
    .orderBy(asc(goalScheduleVersions.effectiveFrom));
}

export async function listSlots(db: TrekDb, versionId: string): Promise<Slot[]> {
  return db
    .select()
    .from(goalSlots)
    .where(eq(goalSlots.scheduleVersionId, versionId))
    .orderBy(asc(goalSlots.weekday), asc(goalSlots.time));
}
