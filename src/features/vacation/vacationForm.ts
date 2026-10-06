import type { VacationWithGoals } from '../../db/repositories/vacations';
import { NOTE_MAX_LENGTH } from '../../domain/limits';
import { isValidDate } from '../goals/goalFormSchema';

export type VacationFormValues = {
  startDate: string;
  endDate: string;
  scope: 'all' | 'selected';
  goalIds: string[];
  note: string;
};

export type VacationError = 'startInvalid' | 'endInvalid' | 'startInPast' | 'endBeforeStart' | 'goalRequired';

export function emptyVacationForm(today: string): VacationFormValues {
  return { startDate: today, endDate: today, scope: 'all', goalIds: [], note: '' };
}

export function vacationToForm(v: VacationWithGoals): VacationFormValues {
  return { startDate: v.startDate, endDate: v.endDate, scope: v.scope, goalIds: v.goalIds, note: v.note ?? '' };
}

/** New vacations start today or later; an existing vacation may keep its original start. */
export function validateVacation(values: VacationFormValues, today: string, originalStart?: string): VacationError | null {
  if (!isValidDate(values.startDate)) return 'startInvalid';
  if (!isValidDate(values.endDate)) return 'endInvalid';
  if (values.startDate < today && values.startDate !== originalStart) return 'startInPast';
  if (values.endDate < values.startDate) return 'endBeforeStart';
  if (values.scope === 'selected' && values.goalIds.length === 0) return 'goalRequired';
  return null;
}

export function vacationInput(values: VacationFormValues) {
  const note = values.note.trim().slice(0, NOTE_MAX_LENGTH);
  return {
    startDate: values.startDate,
    endDate: values.endDate,
    scope: values.scope,
    goalIds: values.scope === 'selected' ? values.goalIds : [],
    note: note === '' ? null : note,
  };
}

export type VacationPhase = 'active' | 'upcoming' | 'past';

export function vacationPhase(v: { startDate: string; endDate: string }, today: string): VacationPhase {
  if (v.endDate < today) return 'past';
  if (v.startDate > today) return 'upcoming';
  return 'active';
}
