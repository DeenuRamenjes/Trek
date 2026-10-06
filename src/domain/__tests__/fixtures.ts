import type { Goal, GoalContext, GoalPause, Log, ScheduleVersion } from '../types';
import type { DomainVacation } from '../types';

export const T = '2026-01-01T00:00:00.000Z';

export function mkGoal(o: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', name: 'G', icon: 'water', color: '#2E7D5B', trackingType: 'check', targetValue: 1, unit: null,
    startDate: '2026-01-01', endDate: null, targetDays: null, pausedAt: null, archivedAt: null, sortOrder: 0,
    createdAt: T, updatedAt: T, ...o,
  } as Goal;
}

export function mkVersion(o: Partial<ScheduleVersion> = {}): ScheduleVersion {
  return {
    id: 'v1', goalId: 'g1', effectiveFrom: '2026-01-01', scheduleType: 'daily', scheduleDays: 0,
    everyNDays: null, timesPerWeek: null, createdAt: T, ...o,
  } as ScheduleVersion;
}

export function mkPause(o: Partial<GoalPause> = {}): GoalPause {
  return { id: 'p1', goalId: 'g1', startDate: '2026-01-10', endDate: null, createdAt: T, updatedAt: T, ...o } as GoalPause;
}

export function mkVacation(o: Partial<DomainVacation> = {}): DomainVacation {
  return {
    id: 'vac1', startDate: '2026-01-10', endDate: '2026-01-12', scope: 'all', note: null, createdAt: T, updatedAt: T,
    goalIds: [], ...o,
  } as DomainVacation;
}

export function mkCtx(o: Partial<GoalContext> = {}): GoalContext {
  return { goal: mkGoal(), versions: [mkVersion()], pauses: [], vacations: [], dayEndsAt: 0, ...o };
}

export function mkLog(o: Partial<Log> & { date: string }): Log {
  return {
    id: `l-${o.date}-${o.goalId ?? 'g1'}-${o.slotId ?? ''}`, goalId: 'g1', slotId: null, value: 1, status: 'done', note: null,
    loggedAt: T, updatedAt: T, ...o,
  } as Log;
}
