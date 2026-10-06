import { useEffect, useState } from 'react';
import { onDbChanged } from '../../db/changes';
import { useDb } from '../../db/DbProvider';
import { listGroupGoals, listGroups, listLogs } from '../../db/repositories';
import { buildWidgetSnapshot, type WidgetSnapshot } from '../../domain/widgetSnapshot';
import { loadGoalContexts } from '../goals/goalContexts';
import { useSettings } from '../settings/settingsStore';
import { useLogicalToday } from '../tracking/useLogicalToday';

/** Groups for the picker and a live snapshot (names always included; the screen masks them). */
export function useWidgetPreview(): { groups: { id: string; name: string }[]; snapshot: WidgetSnapshot | null } {
  const db = useDb();
  const { today } = useLogicalToday();
  const dayEndsAt = useSettings((s) => s.settings.dayEndsAt);
  const groupId = useSettings((s) => s.settings.widget.groupId);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [snapshot, setSnapshot] = useState<WidgetSnapshot | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onDbChanged(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const gs = await listGroups(db);
      const ctxs = await loadGoalContexts(db, { dayEndsAt });
      const logs = await listLogs(db, { from: today, to: today });
      const known = groupId ? gs.some((g) => g.id === groupId) : false;
      const ids = known ? (await listGroupGoals(db, groupId)).map((l) => l.goalId) : null;
      if (!alive) return;
      setGroups(gs.map((g) => ({ id: g.id, name: g.name })));
      setSnapshot(buildWidgetSnapshot({ ctxs, logs, today, groupGoalIds: ids, hideGoalNames: false }));
    })();
    return () => {
      alive = false;
    };
  }, [db, today, dayEndsAt, groupId, tick]);

  return { groups, snapshot };
}
