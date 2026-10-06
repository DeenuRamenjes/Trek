import { format } from 'date-fns';
import type { TrekDb } from '../../db/client';
import { autoBackupFileName, filesToPrune, shouldAutoBackup } from '../../domain/backupPolicy';
import { logicalDate } from '../../domain/dayBoundary';
import type { Settings } from '../../domain/settings';
import { toJson } from './jsonBackup';
import { readSnapshot } from './snapshot';

/** Storage operations the backup logic needs. The Expo implementation lives in files.ts; tests pass a fake. */
export type BackupFs = {
  writeLocal(name: string, text: string): Promise<void>;
  listLocal(): Promise<{ name: string; size: number }[]>;
  readLocal(name: string): Promise<string>;
  deleteLocal(name: string): Promise<void>;
  /** Throws SafAccessError when the granted folder is no longer accessible. */
  writeSaf(folderUri: string, name: string, text: string): Promise<void>;
};

export class SafAccessError extends Error {
  constructor(message = 'Backup folder is no longer accessible') {
    super(message);
    this.name = 'SafAccessError';
  }
}

export type AutoBackupDeps = {
  db: TrekDb;
  fs: BackupFs;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  now: Date;
  appVersion: string;
  /** Hook for platform gating of the SAF write (Android only). */
  safEnabled?: boolean;
};

export type AutoBackupResult = {
  status: 'disabled' | 'already-done' | 'written';
  name?: string;
  pruned: string[];
  safRevoked: boolean;
};

const AUTO_NAME = /^trek-backup-(\d{8})-(\d{6})\.json$/;

/** Logical date of an auto-backup file name (local time stamp minus dayEndsAt). */
export function autoBackupLogicalDate(name: string, dayEndsAt: number): string | null {
  const m = AUTO_NAME.exec(name);
  if (!m) return null;
  const [, d, t] = m;
  const stamp = new Date(
    Number(d.slice(0, 4)),
    Number(d.slice(4, 6)) - 1,
    Number(d.slice(6, 8)),
    Number(t.slice(0, 2)),
    Number(t.slice(2, 4)),
    Number(t.slice(4, 6)),
  );
  return logicalDate(stamp, dayEndsAt);
}

export function isAutoBackupName(name: string): boolean {
  return AUTO_NAME.test(name);
}

let revokedNotice = false;

/** True once after a revoked SAF folder was cleared; the Backup screen shows a message. */
export function takeSafRevokedNotice(): boolean {
  const v = revokedNotice;
  revokedNotice = false;
  return v;
}

export function markSafRevoked(): void {
  revokedNotice = true;
}

export function clearRevokedFolder(updateSettings: (patch: Partial<Settings>) => void): void {
  updateSettings({ androidBackupFolderUri: undefined });
  markSafRevoked();
}

/** First open of each logical day: write a JSON backup, keep the newest 7, mirror to the SAF folder. */
export async function runAutoBackup(deps: AutoBackupDeps): Promise<AutoBackupResult> {
  const { fs, settings, now } = deps;
  if (!settings.autoBackupEnabled) return { status: 'disabled', pruned: [], safRevoked: false };

  const today = logicalDate(now, settings.dayEndsAt);
  const existing = (await fs.listLocal()).map((f) => f.name);
  const lastDate =
    existing
      .filter(isAutoBackupName)
      .sort()
      .map((n) => autoBackupLogicalDate(n, settings.dayEndsAt))
      .pop() ?? null;
  if (!shouldAutoBackup(lastDate, today)) return { status: 'already-done', pruned: [], safRevoked: false };

  const snapshot = await readSnapshot(deps.db, settings);
  const text = toJson(snapshot, { appVersion: deps.appVersion, exportedAt: now.toISOString() });
  const name = autoBackupFileName(now);
  await fs.writeLocal(name, text);

  const pruned = filesToPrune([...existing, name]);
  for (const p of pruned) await fs.deleteLocal(p);

  let safRevoked = false;
  const folder = settings.androidBackupFolderUri;
  if (folder && deps.safEnabled !== false) {
    try {
      await fs.writeSaf(folder, name, text);
    } catch (e) {
      if (e instanceof SafAccessError) {
        safRevoked = true;
        clearRevokedFolder(deps.updateSettings);
      } else {
        throw e;
      }
    }
  }
  return { status: 'written', name, pruned, safRevoked };
}

/** Auto-backups for the restore list, newest first, with a readable date. */
export async function listAutoBackups(fs: BackupFs): Promise<{ name: string; size: number; label: string }[]> {
  const items = (await fs.listLocal()).filter((f) => isAutoBackupName(f.name));
  return items
    .sort((a, b) => (a.name < b.name ? 1 : -1))
    .map((f) => {
      const m = AUTO_NAME.exec(f.name)!;
      const d = m[1];
      const t = m[2];
      const date = new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)), Number(t.slice(0, 2)), Number(t.slice(2, 4)));
      return { ...f, label: format(date, 'd MMM yyyy, HH:mm') };
    });
}

/** Writes the safety backup that always precedes an import. Name is never pruned. */
export async function writePreImportBackup(deps: Pick<AutoBackupDeps, 'db' | 'fs' | 'settings' | 'now' | 'appVersion'>): Promise<string> {
  const snapshot = await readSnapshot(deps.db, deps.settings);
  const text = toJson(snapshot, { appVersion: deps.appVersion, exportedAt: deps.now.toISOString() });
  const name = `trek-preimport-${format(deps.now, 'yyyyMMdd-HHmmss')}.json`;
  await deps.fs.writeLocal(name, text);
  return name;
}
