import { strings } from '../../../strings/en';
import { dayEndsLabel } from '../dayEndsLabel';

it('hour 0 is Midnight in both formats', () => {
  expect(dayEndsLabel(0, '12h')).toBe(strings.settings.appearanceScreen.midnight);
  expect(dayEndsLabel(0, '24h')).toBe(strings.settings.appearanceScreen.midnight);
});
it('12h shows AM times', () => {
  expect([1, 2, 3, 4].map((h) => dayEndsLabel(h, '12h'))).toEqual(['1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM']);
});
it('24h shows padded times', () => {
  expect([1, 4].map((h) => dayEndsLabel(h, '24h'))).toEqual(['01:00', '04:00']);
});
