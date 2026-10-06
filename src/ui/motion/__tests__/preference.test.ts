import { resolveReduceMotion } from '../preference';

describe('resolveReduceMotion', () => {
  it('follows the system when the override is system', () => {
    expect(resolveReduceMotion('system', true)).toBe(true);
    expect(resolveReduceMotion('system', false)).toBe(false);
  });

  it('forces reduce motion on', () => {
    expect(resolveReduceMotion('on', false)).toBe(true);
  });

  it('forces reduce motion off', () => {
    expect(resolveReduceMotion('off', true)).toBe(false);
  });
});
