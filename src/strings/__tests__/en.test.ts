import { strings } from '../en';

const EMOJI = /\p{Extended_Pictographic}/u;

function collect(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
  } else if (typeof value === 'function') {
    out.push(String(value(1, 2)));
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collect(child, out);
  }
}

describe('strings', () => {
  it('names the app Trek', () => {
    expect(strings.appName).toBe('Trek');
  });

  it('contains no empty strings', () => {
    const all: string[] = [];
    collect(strings, all);
    expect(all.length).toBeGreaterThan(50);
    for (const s of all) expect(s.trim().length).toBeGreaterThan(0);
  });

  it('contains no emojis', () => {
    const all: string[] = [];
    collect(strings, all);
    for (const s of all) expect(s).not.toMatch(EMOJI);
  });

  it('uses the exact spec copy', () => {
    expect(strings.goalForm.scheduleNote).toBe('Changes apply from today; past stats are kept');
    expect(strings.stats.emptyRequireGroup).toBe('Create a group with goals to see statistics');
    expect(strings.today.backupBanner(4)).toBe('Last backup 4 days ago');
    expect(strings.settings.dayEndsAt).toBe('My day ends at');
    expect(strings.today.endVacation).toBe('End vacation now');
    expect(strings.today.backupBanner(1)).toBe('Last backup 1 day ago');
    expect(strings.stats.days(1)).toBe('1 day');
    expect(strings.stats.days(12)).toBe('12 days');
  });
});
