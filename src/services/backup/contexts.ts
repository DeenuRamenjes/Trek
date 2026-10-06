import type { DomainVacation, GoalContext } from '../../domain/types';
import type { Snapshot } from './snapshot';

/** Builds GoalContexts (all goals, archived included, sorted as stored) from a snapshot. */
export function loadContextsFromSnapshot(snapshot: Snapshot): GoalContext[] {
  const { tables, settings } = snapshot;
  const vacations: DomainVacation[] = tables.vacations.map((v) => ({
    ...v,
    goalIds: tables.vacationGoals.filter((x) => x.vacationId === v.id).map((x) => x.goalId),
  }));
  return tables.goals.map((goal) => {
    const versions = tables.goalScheduleVersions.filter((v) => v.goalId === goal.id);
    const versionIds = new Set(versions.map((v) => v.id));
    return {
      goal,
      versions,
      pauses: tables.goalPauses.filter((p) => p.goalId === goal.id),
      vacations,
      dayEndsAt: settings.dayEndsAt,
      slots: tables.goalSlots.filter((s) => versionIds.has(s.scheduleVersionId)),
    };
  });
}
