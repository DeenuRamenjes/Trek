import type { Snapshot } from './snapshot';

export const JSON_FORMAT = 'trek-json';

export type BackupMeta = {
  format: string;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
};

export type ExportInfo = { appVersion: string; exportedAt: string };

/** Lossless JSON backup. */
export function toJson(snapshot: Snapshot, info: ExportInfo): string {
  const meta: BackupMeta = {
    format: JSON_FORMAT,
    schemaVersion: snapshot.schemaVersion,
    appVersion: info.appVersion,
    exportedAt: info.exportedAt,
  };
  return JSON.stringify({ meta, settings: snapshot.settings, tables: snapshot.tables });
}

export type ParsedJson = { meta: BackupMeta; snapshot: Snapshot };

/** Parses a JSON backup. Structure only; row validation happens in the import pipeline. */
export function parseJson(text: string): ParsedJson {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file');
  }
  const o = raw as { meta?: Partial<BackupMeta>; settings?: unknown; tables?: unknown } | null;
  if (!o || typeof o !== 'object' || !o.meta || o.meta.format !== JSON_FORMAT) throw new Error('Not a Trek JSON backup');
  if (typeof o.meta.schemaVersion !== 'number') throw new Error('Backup has no schemaVersion');
  if (!o.tables || typeof o.tables !== 'object') throw new Error('Backup has no tables');
  const meta: BackupMeta = {
    format: o.meta.format,
    schemaVersion: o.meta.schemaVersion,
    appVersion: String(o.meta.appVersion ?? ''),
    exportedAt: String(o.meta.exportedAt ?? ''),
  };
  return {
    meta,
    snapshot: {
      schemaVersion: meta.schemaVersion,
      settings: (o.settings ?? {}) as Snapshot['settings'],
      tables: o.tables as Snapshot['tables'],
    },
  };
}
