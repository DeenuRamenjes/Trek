import { logCatch } from '../errorLog';
import type { TrekDb } from '../../db/client';
import type { Settings } from '../../domain/settings';
import { toCsvZip } from './csvExporter';
import { writePreImportBackup, type BackupFs } from './autoBackup';
import { canApplyImport } from './importGate';
import { applyImport, type ApplyResult, type ImportMode } from './importApply';
import { parseImport } from './importParser';
import { validateImport, type ValidatedImport } from './importValidate';
import { toJson } from './jsonBackup';
import { readSnapshot } from './snapshot';
import { toXlsx } from './xlsxExporter';

/** Orchestration with injected platform adapters, so it runs in plain node tests. */

export type ExportFormat = 'xlsx' | 'json' | 'csv';
export type ExportFile = { name: string; mime: string; data: Uint8Array | string };

export type ExportDeps = {
  db: TrekDb;
  settings: Settings;
  now: Date;
  today: string;
  appVersion: string;
  /** Writes the file to a temp location and opens the share sheet. */
  share: (file: ExportFile) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
};

const STAMP = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Formats a backup-format setting expands to. */
export function formatsFor(setting: Settings['backupFormat']): ExportFormat[] {
  return setting === 'both' ? ['xlsx', 'json'] : [setting];
}

export async function buildExportFile(deps: Omit<ExportDeps, 'share' | 'updateSettings'>, kind: ExportFormat): Promise<ExportFile> {
  const snapshot = await readSnapshot(deps.db, deps.settings);
  const info = { appVersion: deps.appVersion, exportedAt: deps.now.toISOString() };
  const stamp = STAMP(deps.now);
  if (kind === 'xlsx') return { name: `trek-${stamp}.xlsx`, mime: XLSX_MIME, data: await toXlsx(snapshot, { ...info, today: deps.today }) };
  if (kind === 'csv') return { name: `trek-${stamp}-csv.zip`, mime: 'application/zip', data: await toCsvZip(snapshot, info) };
  return { name: `trek-${stamp}.json`, mime: 'application/json', data: toJson(snapshot, info) };
}

/** Exports each format in turn; a successful share of any file sets lastBackupAt. */
export async function exportBackup(deps: ExportDeps, kinds: ExportFormat[]): Promise<string[]> {
  const names: string[] = [];
  for (const kind of kinds) {
    const file = await buildExportFile(deps, kind);
    await deps.share(file);
    names.push(file.name);
    deps.updateSettings({ lastBackupAt: deps.now.toISOString() });
  }
  return names;
}

export { canApplyImport };

/** Parses and validates; throws ImportFormatError / ImportRejectedError for unusable files. */
export async function previewImport(input: Uint8Array | string): Promise<ValidatedImport> {
  return validateImport(await parseImport(input));
}

export class ImportNotConfirmedError extends Error {
  constructor() {
    super('Invalid rows must be confirmed before importing');
    this.name = 'ImportNotConfirmedError';
  }
}

export type ImportDeps = {
  db: TrekDb;
  fs: BackupFs;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  now: Date;
  appVersion: string;
  reconcile: () => Promise<unknown>;
  refreshWidgets: () => Promise<unknown>;
};

/** Settings that must not travel between devices or installs. */
function importableSettings(settings: ValidatedImport['settings']): Partial<Settings> {
  const patch: Record<string, unknown> = { ...settings };
  delete patch.appLock;
  delete patch.androidBackupFolderUri;
  delete patch.lastKnownTimeZone;
  return patch as Partial<Settings>;
}

/**
 * Safety backup first, then one-transaction apply, then settings (replace only), then reminders and widgets.
 * App-lock state is never imported.
 */
export async function runImport(
  deps: ImportDeps,
  validated: ValidatedImport,
  mode: ImportMode,
  confirmedSkipInvalid: boolean,
): Promise<{ result: ApplyResult; backupName: string }> {
  if (!canApplyImport(validated, confirmedSkipInvalid)) throw new ImportNotConfirmedError();
  const backupName = await writePreImportBackup(deps);
  const result = await applyImport(deps.db, validated, mode);
  if (mode === 'replace') deps.updateSettings(importableSettings(validated.settings));
  await Promise.resolve(deps.reconcile()).catch(logCatch('import.reconcile'));
  await Promise.resolve(deps.refreshWidgets()).catch(logCatch('import.widgets'));
  return { result, backupName };
}
