import { asc, eq } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { withTransaction } from '../transaction';
import { newId } from '../ids';
import { reminders, type Reminder } from '../schema';

export type ReminderInput = Pick<Reminder, 'weekday' | 'time'> & Partial<Pick<Reminder, 'slotId' | 'offsetMin' | 'enabled'>>;

export async function setReminders(db: TrekDb, goalId: string, items: ReminderInput[]): Promise<void> {
  await withTransaction(db, (tx) => setRemindersTx(tx, goalId, items));
}

/** setReminders without its own transaction; call only inside an open withTransaction. */
export async function setRemindersTx(tx: TrekDb, goalId: string, items: ReminderInput[]): Promise<void> {
  await tx.delete(reminders).where(eq(reminders.goalId, goalId));
  for (const r of items) {
    await tx.insert(reminders).values({
      id: newId(),
      goalId,
      slotId: r.slotId ?? null,
      weekday: r.weekday,
      time: r.time,
      offsetMin: r.offsetMin ?? 0,
      enabled: r.enabled ?? true,
    });
  }
}

export async function listReminders(db: TrekDb, goalId?: string): Promise<Reminder[]> {
  const q = db.select().from(reminders);
  return (goalId ? q.where(eq(reminders.goalId, goalId)) : q).orderBy(asc(reminders.weekday), asc(reminders.time));
}
