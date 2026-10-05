import type { DomainVacation } from './types';

export function vacationCovers(vacations: DomainVacation[], goalId: string, date: string): boolean {
  return vacations.some(
    (v) =>
      v.startDate <= date &&
      date <= v.endDate &&
      (v.scope === 'all' || v.goalIds.includes(goalId)),
  );
}

/** Vacation covering `today` (earliest start first), or undefined. */
export function activeVacation(vacations: DomainVacation[], today: string): DomainVacation | undefined {
  return vacations
    .filter((v) => v.startDate <= today && today <= v.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
}
