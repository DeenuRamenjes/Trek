import { AndroidImportance } from 'expo-notifications';
import type { notificationsAdapter as Adapter } from './adapter';

export const REVIEWS_CHANNEL = 'reviews';
export const BACKUP_CHANNEL = 'backup';
const GOAL_PREFIX = 'goal-';

export const goalChannelId = (goalId: string) => `${GOAL_PREFIX}${goalId}`;

type ChannelAdapter = Pick<typeof Adapter, 'setChannel' | 'deleteChannel' | 'listChannels'>;

/** Android only: one channel per goal plus reviews and backup; channels of removed goals are deleted. */
export async function syncChannels(
  adapter: ChannelAdapter,
  goals: { id: string; name: string }[],
  names: { reviews: string; backup: string },
): Promise<void> {
  await adapter.setChannel(REVIEWS_CHANNEL, { name: names.reviews, importance: AndroidImportance.DEFAULT });
  await adapter.setChannel(BACKUP_CHANNEL, { name: names.backup, importance: AndroidImportance.LOW });
  for (const g of goals) {
    await adapter.setChannel(goalChannelId(g.id), { name: g.name, importance: AndroidImportance.DEFAULT });
  }
  const wanted = new Set(goals.map((g) => goalChannelId(g.id)));
  for (const c of await adapter.listChannels()) {
    if (c.id.startsWith(GOAL_PREFIX) && !wanted.has(c.id)) await adapter.deleteChannel(c.id);
  }
}
