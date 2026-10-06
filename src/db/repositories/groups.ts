import { asc, desc, eq } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { emitDbChanged } from '../changes';
import { withTransaction } from '../transaction';
import { newId, nowIso } from '../ids';
import { groupGoals, groups, type Group, type GroupGoal } from '../schema';

export type GroupInput = { name: string; color: string; icon: string; sortOrder?: number };

export async function createGroup(db: TrekDb, input: GroupInput): Promise<Group> {
  const now = nowIso();
  const id = newId();
  await db.insert(groups).values({ ...input, id, createdAt: now, updatedAt: now });
  emitDbChanged();
  return (await getGroup(db, id)) as Group;
}

export async function getGroup(db: TrekDb, id: string): Promise<Group | undefined> {
  return (await db.select().from(groups).where(eq(groups.id, id)))[0];
}

export async function listGroups(db: TrekDb): Promise<Group[]> {
  return db.select().from(groups).orderBy(asc(groups.sortOrder), asc(groups.createdAt));
}

export async function updateGroup(db: TrekDb, id: string, patch: Partial<GroupInput>): Promise<void> {
  await db.update(groups).set({ ...patch, updatedAt: nowIso() }).where(eq(groups.id, id));
  emitDbChanged();
}

export async function deleteGroup(db: TrekDb, id: string): Promise<void> {
  await db.delete(groups).where(eq(groups.id, id));
  emitDbChanged();
}

export async function reorderGroups(db: TrekDb, ids: string[]): Promise<void> {
  const now = nowIso();
  await withTransaction(db, async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(groups).set({ sortOrder: i, updatedAt: now }).where(eq(groups.id, ids[i]));
    }
  });
}

export async function setGroupGoals(db: TrekDb, groupId: string, goalIds: string[]): Promise<void> {
  await withTransaction(db, (tx) => setGroupGoalsTx(tx, groupId, goalIds));
}

/** setGroupGoals without its own transaction; call only inside an open withTransaction. */
export async function setGroupGoalsTx(tx: TrekDb, groupId: string, goalIds: string[]): Promise<void> {
  await tx.delete(groupGoals).where(eq(groupGoals.groupId, groupId));
  for (const goalId of new Set(goalIds)) await tx.insert(groupGoals).values({ groupId, goalId });
  await tx.update(groups).set({ updatedAt: nowIso() }).where(eq(groups.id, groupId));
}

/** createGroup without its own emit; call only inside an open withTransaction. Appends at the end. */
export async function createGroupTx(tx: TrekDb, input: GroupInput): Promise<Group> {
  const now = nowIso();
  const id = newId();
  const last = (await tx.select().from(groups).orderBy(desc(groups.sortOrder)).limit(1))[0];
  const sortOrder = input.sortOrder ?? (last ? last.sortOrder + 1 : 0);
  await tx.insert(groups).values({ ...input, sortOrder, id, createdAt: now, updatedAt: now });
  return (await getGroup(tx, id)) as Group;
}

/** updateGroup without its own emit; call only inside an open withTransaction. */
export async function updateGroupTx(tx: TrekDb, id: string, patch: Partial<GroupInput>): Promise<void> {
  await tx.update(groups).set({ ...patch, updatedAt: nowIso() }).where(eq(groups.id, id));
}

export async function listGroupGoals(db: TrekDb, groupId?: string): Promise<GroupGoal[]> {
  const q = db.select().from(groupGoals);
  return groupId ? q.where(eq(groupGoals.groupId, groupId)) : q;
}
