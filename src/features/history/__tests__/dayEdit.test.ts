import { mkGoal, mkLog } from '../../../domain/__tests__/fixtures';
import type { Slot } from '../../../domain/types';
import { initialEditState, planDayEdit, valueForStatus } from '../dayEdit';

const slots = [
  { id: 's1', scheduleVersionId: 'v1', weekday: 0, time: '08:00', label: null },
  { id: 's2', scheduleVersionId: 'v1', weekday: 0, time: '20:00', label: null },
] as Slot[];
const check = mkGoal();
const count = mkGoal({ trackingType: 'count', targetValue: 8 });

describe('dayEdit', () => {
  it('check done writes value 1; partial writes 0; skipped writes 0', () => {
    const base = { value: 0, note: '', slotDone: [] };
    expect(planDayEdit(check, [], [], { ...base, status: 'done' })).toEqual([{ kind: 'upsert', slotId: null, value: 1, status: 'done', note: null }]);
    expect(planDayEdit(check, [], [], { ...base, status: 'partial' })[0]).toMatchObject({ value: 0, status: 'partial' });
    expect(planDayEdit(check, [], [], { ...base, status: 'skipped' })[0]).toMatchObject({ value: 0, status: 'skipped' });
  });

  it('a skipped or partial entry with a note is valid; blank note becomes null', () => {
    expect(planDayEdit(check, [], [], { status: 'skipped', value: 0, note: 'sick', slotDone: [] })[0]).toMatchObject({ note: 'sick' });
    expect(planDayEdit(check, [], [], { status: 'done', value: 0, note: '   ', slotDone: [] })[0]).toMatchObject({ note: null });
  });

  it('done lifts value to at least the target; partial picks a value below target', () => {
    expect(valueForStatus(count, 'done', 3)).toBe(8);
    expect(valueForStatus(count, 'done', 12)).toBe(12);
    expect(valueForStatus(count, 'partial', 3)).toBe(3);
    expect(valueForStatus(count, 'partial', 0)).toBe(4);
    expect(valueForStatus(count, 'partial', 9)).toBe(4);
  });

  it('no status deletes the existing log', () => {
    const l = mkLog({ date: '2026-01-05' });
    expect(planDayEdit(check, [], [l], { status: null, value: 0, note: '', slotDone: [] })).toEqual([{ kind: 'delete', id: l.id }]);
    expect(planDayEdit(check, [], [], { status: null, value: 0, note: '', slotDone: [] })).toEqual([]);
  });

  it('slot goals write per-slot logs and delete unchecked ones', () => {
    const l2 = mkLog({ date: '2026-01-05', slotId: 's2' });
    const ops = planDayEdit(check, slots, [l2], { status: 'partial', value: 0, note: '', slotDone: ['s1'] });
    expect(ops).toEqual([
      { kind: 'upsert', slotId: 's1', value: 1, status: 'done', note: null },
      { kind: 'delete', id: l2.id },
    ]);
    expect(initialEditState(check, slots, [l2])).toMatchObject({ status: 'partial', slotDone: ['s2'] });
  });

  it('initial state reads status, value and note from logs', () => {
    expect(initialEditState(count, [], [mkLog({ date: 'd', value: 3, status: 'partial', note: 'n' })])).toEqual({ status: 'partial', value: 3, note: 'n', slotDone: [] });
    expect(initialEditState(count, [], [])).toMatchObject({ status: null, value: 0 });
    expect(initialEditState(check, [], [mkLog({ date: 'd', status: 'skipped', value: 0 })]).status).toBe('skipped');
  });
});
