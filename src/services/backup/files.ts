import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { deleteAsync, StorageAccessFramework, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getDb } from '../../db/client';
import { useSettings } from '../../features/settings/settingsStore';
import { logicalToday } from '../../domain/dayBoundary';
import { createRuntimeLifecycle } from '../notifications/runtime';
import { refreshWidgets } from '../widgetBridge';
import { runAutoBackup, SafAccessError, type BackupFs } from './autoBackup';
import { exportBackup, formatsFor, runImport, type ExportFile, type ExportFormat } from './backupFlow';
import type { ValidatedImport } from './importValidate';
import type { ImportMode } from './importApply';

/** Expo-bound side of backup: file system, share sheet, pickers. Logic lives in autoBackup.ts and backupFlow.ts. */

export const appVersion: string = Constants.expoConfig?.version ?? '0.0.0';

function backupDir(): Directory {
  const dir = new Directory(Paths.document, 'backups');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export const expoBackupFs: BackupFs = {
  async writeLocal(name, text) {
    const file = new File(backupDir(), name);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
  },
  async listLocal() {
    return backupDir()
      .list()
      .filter((e): e is File => e instanceof File)
      .map((f) => ({ name: f.name, size: f.size ?? 0 }));
  },
  async readLocal(name) {
    return new File(backupDir(), name).text();
  },
  async deleteLocal(name) {
    const file = new File(backupDir(), name);
    if (file.exists) file.delete();
  },
  async writeSaf(folderUri, name, text) {
    try {
      const uri = await StorageAccessFramework.createFileAsync(folderUri, name, 'application/json');
      await writeAsStringAsync(uri, text);
    } catch {
      throw new SafAccessError();
    }
  },
  async listSaf(folderUri) {
    try {
      const uris = await StorageAccessFramework.readDirectoryAsync(folderUri);
      return uris.map((uri) => ({ uri, name: decodeURIComponent(uri).split(/[/:]/).pop() ?? uri }));
    } catch {
      throw new SafAccessError();
    }
  },
  async deleteSaf(uri) {
    await deleteAsync(uri, { idempotent: true });
  },
};

/** True when the persisted SAF grant still lists. */
export async function safFolderAccessible(folderUri: string): Promise<boolean> {
  try {
    await StorageAccessFramework.readDirectoryAsync(folderUri);
    return true;
  } catch {
    return false;
  }
}

/** Android only: opens the folder picker; returns the granted tree URI or null. */
export async function chooseBackupFolder(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  return result.granted ? result.directoryUri : null;
}

const UTI: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'org.openxmlformats.spreadsheetml.sheet',
  'application/json': 'public.json',
  'application/zip': 'public.zip-archive',
};

/** Writes to the cache dir and opens the share sheet. */
export async function shareExportFile(file: ExportFile): Promise<void> {
  const target = new File(Paths.cache, file.name);
  if (target.exists) target.delete();
  target.create();
  target.write(file.data);
  await Sharing.shareAsync(target.uri, { mimeType: file.mime, UTI: UTI[file.mime], dialogTitle: file.name });
}

function nowDeps() {
  const settings = useSettings.getState().settings;
  const now = new Date();
  return { db: getDb(), settings, now, today: logicalToday(now, settings.dayEndsAt), appVersion, updateSettings: useSettings.getState().update };
}

export function exportKinds(kinds: ExportFormat[]): Promise<string[]> {
  return exportBackup({ ...nowDeps(), share: shareExportFile }, kinds);
}

/** Default-format export (used by the Today banner). */
export function exportDefault(): Promise<string[]> {
  return exportKinds(formatsFor(useSettings.getState().settings.backupFormat));
}

export function runDailyAutoBackup() {
  const d = nowDeps();
  return runAutoBackup({ db: d.db, fs: expoBackupFs, settings: d.settings, updateSettings: d.updateSettings, now: d.now, appVersion, safEnabled: Platform.OS === 'android' });
}

/** Opens the document picker and returns file contents (text for json, bytes otherwise); null when cancelled. */
export async function pickImportFile(): Promise<Uint8Array | string | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const file = new File(asset.uri);
  return asset.name.toLowerCase().endsWith('.json') ? file.text() : file.bytes();
}

export async function readAutoBackup(name: string): Promise<string> {
  return expoBackupFs.readLocal(name);
}

export async function applyValidatedImport(validated: ValidatedImport, mode: ImportMode, confirmedSkipInvalid: boolean) {
  const d = nowDeps();
  const lc = createRuntimeLifecycle();
  return runImport(
    { db: d.db, fs: expoBackupFs, settings: d.settings, updateSettings: d.updateSettings, now: d.now, appVersion, reconcile: lc.runCycle, refreshWidgets },
    validated,
    mode,
    confirmedSkipInvalid,
  );
}
