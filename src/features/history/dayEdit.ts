import type { Goal, Log, Slot } from '../../domain/types';

export type EditStatus = 'done' | 'partial' | 'skipped';

export type EditState = {
  status: EditStatus | null;
  value: number;
  note: string;
  /** Slot goals: ids of the slots marked done. */
  slotDone: string[];
};

export type DayOp =
  | { kind: 'upsert'; slotId: string | null; value: number; status: Log['status']; note: string | null }
  | { kind: 'delete'; id: string };

type Target = Pick<Goal, 'trackingType' | 'targetValue'>;

/** Editor state for a day from its existing logs. */
export function initialEditState(goal: Target, slots: Slot[], existing: Log[]): EditState {
  const note = existing.find((l) => l.note)?.note ?? '';
  if (slots.length > 0) {
    const skipped = existing.some((l) => l.status === 'skipped');
    const slotDone = slots.filter((s) => existing.some((l) => l.slotId === s.id && l.status === 'done')).map((s) => s.id);
    return { status: skipped ? 'skipped' : slotStatus(slots.length, slotDone.length), value: 0, note, slotDone };
  }
  if (existing.length === 0) return { status: null, value: 0, note: '', slotDone: [] };
  const skipped = existing.some((l) => l.status === 'skipped');
  const value = existing.filter((l) => l.status !== 'skipped').reduce((sum, l) => sum + l.value, 0);
  if (skipped) return { status: 'skipped', value, note, slotDone: [] };
  if (goal.trackingType === 'check') {
    return { status: existing.some((l) => l.status === 'done') ? 'done' : 'partial', value, note, slotDone: [] };
  }
  return { status: derivedStatus(goal, value), value, note, slotDone: [] };
}

export function slotStatus(total: number, done: number): EditStatus | null {
  if (done === 0) return null;
  return done === total ? 'done' : 'partial';
}

/** Status implied by a value for count, duration and value goals; null at zero. */
export function derivedStatus(goal: Target, value: number): EditStatus | null {
  if (value <= 0) return null;
  return value >= goal.targetValue ? 'done' : 'partial';
}

/** Value to use when the user picks `status` explicitly. */
export function valueForStatus(goal: Target, status: EditStatus, value: number): number {
  if (goal.trackingType === 'check' || status === 'skipped') return goal.trackingType === 'check' ? (status === 'done' ? 1 : 0) : value;
  if (status === 'done') return Math.max(value, goal.targetValue);
  if (value > 0 && value < goal.targetValue) return value;
  return goal.targetValue > 1 ? Math.max(1, Math.floor(goal.targetValue / 2)) : goal.targetValue / 2;
}

/** Log writes that turn the existing logs of one day into the edited state. */
export function planDayEdit(goal: Target, slots: Slot[], existing: Log[], state: EditState): DayOp[] {
  const note = state.note.trim() === '' ? null : state.note;
  const ops: DayOp[] = [];
  if (slots.length > 0) {
    for (const slot of slots) {
      const prev = existing.find((l) => l.slotId === slot.id);
      if (state.status === 'skipped') ops.push({ kind: 'upsert', slotId: slot.id, value: 0, status: 'skipped', note });
      else if (state.slotDone.includes(slot.id)) ops.push({ kind: 'upsert', slotId: slot.id, value: 1, status: 'done', note });
      else if (prev) ops.push({ kind: 'delete', id: prev.id });
    }
    return ops;
  }
  const prev = existing.find((l) => l.slotId == null);
  if (state.status === null) return prev ? [{ kind: 'delete', id: prev.id }] : [];
  const isCheck = goal.trackingType === 'check';
  const value = state.status === 'skipped' ? 0 : isCheck ? (state.status === 'done' ? 1 : 0) : state.value;
  ops.push({ kind: 'upsert', slotId: null, value, status: state.status, note });
  return ops;
}
