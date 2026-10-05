import type { TrekDb } from '../../db/client';
import { createGroupTx, deleteGroup, getGroup, listGroupGoals, setGroupGoalsTx, updateGroupTx } from '../../db/repositories';
import { withTransaction } from '../../db/transaction';

export type GroupFormValues = { name: string; color: string; icon: string; goalIds: string[] };

/** Creates or updates a group and its membership in one transaction. Returns the group id. Throws on a blank name. */
export async function saveGroup(db: TrekDb, groupId: string | null, v: GroupFormValues): Promise<string> {
  const name = v.name.trim();
  if (name === '') throw new Error('Group name is required');
  const fields = { name, color: v.color.toUpperCase(), icon: v.icon };
  return withTransaction(db, async (tx) => {
    let id: string;
    if (groupId === null) id = (await createGroupTx(tx, fields)).id;
    else {
      id = groupId;
      await updateGroupTx(tx, id, fields);
    }
    await setGroupGoalsTx(tx, id, v.goalIds);
    return id;
  });
}

/** Form values for editing; undefined when the group is missing. */
export async function loadGroupFormValues(db: TrekDb, groupId: string): Promise<GroupFormValues | undefined> {
  const g = await getGroup(db, groupId);
  if (!g) return undefined;
  const links = await listGroupGoals(db, groupId);
  return { name: g.name, color: g.color, icon: g.icon, goalIds: links.map((l) => l.goalId) };
}

/** Deletes the group and its links; goals are untouched. */
export async function removeGroup(db: TrekDb, groupId: string): Promise<void> {
  await deleteGroup(db, groupId);
}
