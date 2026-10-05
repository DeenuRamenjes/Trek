import { addDays, format } from 'date-fns';
import type { Settings } from './settings';

/** Backup reminder and auto-backup policy (design 3.9). Pure. */

export type BackupFrequency = Settings['backupReminderFrequency'];

export const BACKUP_SNOOZE_DAYS = 3;
export const AUTO_BACKUP_KEEP = 7;

const FREQUENCY_DAYS: Record<Exclude<BackupFrequency, 'off'>, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};
const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupState = {
  now: Date;
  frequency: BackupFrequency;
  lastBackupAt?: string | null;
  /** Earliest goal createdAt, used when there is no backup yet. Undefined when there are no goals. */
  earliestGoalCreatedAt?: string | null;
  backupBannerSnoozedUntil?: string | null;
};

function referenceTime(s: BackupState): number | null {
  const ref = s.lastBackupAt ?? s.earliestGoalCreatedAt;
  if (!ref) return null;
  const t = Date.parse(ref);
  return Number.isNaN(t) ? null : t;
}

/** Whole days since the last backup (or the reference date); null when there is no reference. */
export function daysSinceBackup(s: BackupState): number | null {
  const ref = referenceTime(s);
  if (ref === null) return null;
  return Math.max(0, Math.floor((s.now.getTime() - ref) / DAY_MS));
}

export function isBackupOverdue(s: BackupState): boolean {
  if (s.frequency === 'off') return false;
  const ref = referenceTime(s);
  if (ref === null) return false;
  return s.now.getTime() - ref > FREQUENCY_DAYS[s.frequency] * DAY_MS;
}

export function showBackupBanner(s: BackupState): boolean {
  if (!isBackupOverdue(s)) return false;
  if (s.backupBannerSnoozedUntil) {
    const until = Date.parse(s.backupBannerSnoozedUntil);
    if (!Number.isNaN(until) && s.now.getTime() < until) return false;
  }
  return true;
}

/** ISO timestamp 3 days after `now`. */
export function snoozeUntil(now: Date): string {
  return addDays(now, BACKUP_SNOOZE_DAYS).toISOString();
}

const AUTO_NAME = /^trek-backup-(\d{8}-\d{6})\.json$/;

/** `trek-backup-yyyyMMdd-HHmmss.json` in device-local time. */
export function autoBackupFileName(now: Date): string {
  return `trek-backup-${format(now, 'yyyyMMdd-HHmmss')}.json`;
}

/** First open of a logical day: true when no auto-backup ran on `today` yet. */
export function shouldAutoBackup(lastAutoDate: string | null | undefined, today: string): boolean {
  return lastAutoDate !== today;
}

/** Names to delete so only the newest 7 auto-backups remain. Other file names are never pruned. */
export function filesToPrune(names: string[], keep: number = AUTO_BACKUP_KEEP): string[] {
  const backups = names
    .map((name) => ({ name, stamp: AUTO_NAME.exec(name)?.[1] }))
    .filter((e): e is { name: string; stamp: string } => e.stamp !== undefined)
    .sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
  return backups.slice(keep).map((e) => e.name);
}
