import { activeVacation, vacationCovers } from '../vacationRules';
import { mkVacation } from './fixtures';

describe('vacationRules', () => {
  it('scope all covers any goal, inclusive bounds', () => {
    const v = [mkVacation()];
    expect(vacationCovers(v, 'x', '2026-01-10')).toBe(true);
    expect(vacationCovers(v, 'x', '2026-01-12')).toBe(true);
    expect(vacationCovers(v, 'x', '2026-01-09')).toBe(false);
    expect(vacationCovers(v, 'x', '2026-01-13')).toBe(false);
  });
  it('scope selected covers only listed goals', () => {
    const v = [mkVacation({ scope: 'selected', goalIds: ['a'] })];
    expect(vacationCovers(v, 'a', '2026-01-11')).toBe(true);
    expect(vacationCovers(v, 'b', '2026-01-11')).toBe(false);
  });
  it('activeVacation', () => {
    const a = mkVacation({ id: 'a', startDate: '2026-01-05', endDate: '2026-01-20' });
    const b = mkVacation({ id: 'b', startDate: '2026-01-10', endDate: '2026-01-12' });
    expect(activeVacation([b, a], '2026-01-11')?.id).toBe('a');
    expect(activeVacation([a, b], '2026-01-21')).toBeUndefined();
    expect(activeVacation([], '2026-01-11')).toBeUndefined();
  });
});
