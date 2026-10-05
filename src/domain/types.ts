import type { Goal, GoalPause, ScheduleVersion, Vacation } from '../db/schema';

export type { Goal, GoalPause, ScheduleVersion };

/** Vacation row plus the goals it selects (empty when scope is 'all'). */
export type DomainVacation = Vacation & { goalIds: string[] };

/** Everything needed to decide whether a goal is due on a date. */
export type GoalContext = {
  goal: Goal;
  versions: ScheduleVersion[];
  pauses: GoalPause[];
  vacations: DomainVacation[];
  dayEndsAt: number;
};
