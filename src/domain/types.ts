import type { Goal, GoalPause, Log, ScheduleVersion, Slot, Vacation } from '../db/schema';

export type { Goal, GoalPause, Log, ScheduleVersion, Slot };

/** Vacation row plus the goals it selects (empty when scope is 'all'). */
export type DomainVacation = Vacation & { goalIds: string[] };

/** Everything needed to decide whether a goal is due on a date. */
export type GoalContext = {
  goal: Goal;
  versions: ScheduleVersion[];
  pauses: GoalPause[];
  vacations: DomainVacation[];
  dayEndsAt: number;
  /** Slots of all schedule versions of the goal; absent means no slots. */
  slots?: Slot[];
};
