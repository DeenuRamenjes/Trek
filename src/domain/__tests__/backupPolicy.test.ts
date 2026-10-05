import {
  autoBackupFileName, daysSinceBackup, filesToPrune, isBackupOverdue, shouldAutoBackup, showBackupBanner, snoozeUntil,
} from '../backupPolicy';

const now = new Date('2026-10-20T12:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

describe('isBackupOverdue', () => {
  it('uses frequency thresholds, strictly greater', () => {
    expect(isBackupOverdue({ now, frequency: 'weekly', lastBackupAt: daysAgo(7) })).toBe(false);
    expect(isBackupOverdue({ now, frequency: 'weekly', lastBackupAt: daysAgo(8) })).toBe(true);
    expect(isBackupOverdue({ now, frequency: 'biweekly', lastBackupAt: daysAgo(14) })).toBe(false);
    expect(isBackupOverdue({ now, frequency: 'biweekly', lastBackupAt: daysAgo(15) })).toBe(true);
    expect(isBackupOverdue({ now, frequency: 'monthly', lastBackupAt: daysAgo(30) })).toBe(false);
    expect(isBackupOverdue({ now, frequency: 'monthly', lastBackupAt: daysAgo(31) })).toBe(true);
  });
  it('never when off', () => {
    expect(isBackupOverdue({ now, frequency: 'off', lastBackupAt: daysAgo(400) })).toBe(false);
  });
  it('counts from earliest goal when no backup; never overdue with no goals', () => {
    expect(isBackupOverdue({ now, frequency: 'weekly', earliestGoalCreatedAt: daysAgo(10) })).toBe(true);
    expect(isBackupOverdue({ now, frequency: 'weekly', earliestGoalCreatedAt: daysAgo(3) })).toBe(false);
    expect(isBackupOverdue({ now, frequency: 'weekly' })).toBe(false);
  });
  it('lastBackupAt wins over goal age', () => {
    expect(isBackupOverdue({ now, frequency: 'weekly', lastBackupAt: daysAgo(1), earliestGoalCreatedAt: daysAgo(100) })).toBe(false);
  });
});

describe('daysSinceBackup', () => {
  it('whole days, null without reference', () => {
    expect(daysSinceBackup({ now, frequency: 'weekly', lastBackupAt: daysAgo(9.5) })).toBe(9);
    expect(daysSinceBackup({ now, frequency: 'weekly' })).toBeNull();
  });
});

describe('banner and snooze', () => {
  const base = { now, frequency: 'weekly' as const, lastBackupAt: daysAgo(20) };
  it('shows when overdue', () => expect(showBackupBanner(base)).toBe(true));
  it('hidden while snoozed, back after', () => {
    const until = snoozeUntil(now);
    expect(showBackupBanner({ ...base, backupBannerSnoozedUntil: until })).toBe(false);
    expect(showBackupBanner({ ...base, now: new Date(Date.parse(until) + 1), backupBannerSnoozedUntil: until })).toBe(true);
  });
  it('hidden when not overdue', () => {
    expect(showBackupBanner({ ...base, lastBackupAt: daysAgo(1) })).toBe(false);
  });
  it('snooze is 3 days', () => {
    expect(Date.parse(snoozeUntil(now)) - now.getTime()).toBe(3 * 86400000);
  });
});

describe('auto backup', () => {
  it('file name uses local timestamp', () => {
    expect(autoBackupFileName(new Date(2026, 9, 5, 7, 4, 9))).toBe('trek-backup-20261005-070409.json');
  });
  it('first open each logical day', () => {
    expect(shouldAutoBackup(null, '2026-10-05')).toBe(true);
    expect(shouldAutoBackup('2026-10-04', '2026-10-05')).toBe(true);
    expect(shouldAutoBackup('2026-10-05', '2026-10-05')).toBe(false);
  });
  it('prunes all but newest 7, ignoring foreign files', () => {
    const names = Array.from({ length: 10 }, (_, i) => `trek-backup-202610${String(i + 1).padStart(2, '0')}-080000.json`);
    const shuffled = [...names].reverse();
    expect(filesToPrune([...shuffled, 'notes.txt'])).toEqual([names[2], names[1], names[0]]);
    expect(filesToPrune(names.slice(0, 7))).toEqual([]);
  });
  it('orders by timestamp within a day', () => {
    const a = 'trek-backup-20261001-090000.json';
    const b = 'trek-backup-20261001-180000.json';
    expect(filesToPrune([a, b], 1)).toEqual([a]);
  });
});
