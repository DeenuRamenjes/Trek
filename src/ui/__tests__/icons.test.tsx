import { Ionicons } from '@expo/vector-icons';
import { goalIcons, statusIcons, uiIcons } from '../icons';

const glyphs = Ionicons.glyphMap as Record<string, number>;

describe('icons', () => {
  it('every curated goal icon exists in Ionicons', () => {
    for (const name of goalIcons) expect(glyphs[name]).toBeDefined();
  });

  it('offers 20 unique goal icons', () => {
    expect(new Set(goalIcons).size).toBe(20);
  });

  it('every status icon exists, and only notDue has none', () => {
    for (const [status, name] of Object.entries(statusIcons)) {
      if (status === 'notDue') {
        expect(name).toBeNull();
      } else {
        expect(glyphs[name as string]).toBeDefined();
      }
    }
  });

  it('every UI icon exists in Ionicons', () => {
    for (const name of Object.values(uiIcons)) expect(glyphs[name]).toBeDefined();
  });
});
