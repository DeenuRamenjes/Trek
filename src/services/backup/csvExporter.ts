import JSZip from 'jszip';
import type { ExportInfo } from './jsonBackup';
import { settingsEntries, TABLE_SPECS, tableRows, type Snapshot } from './snapshot';

/** RFC 4180 field: quoted when it holds a comma, quote, CR or LF. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvField).join(',');
}

function csv(header: string[], rows: unknown[][]): string {
  return [csvLine(header), ...rows.map(csvLine)].join('\r\n') + '\r\n';
}

/** One CSV per raw table plus Settings.csv and _Meta.csv, zipped. */
export async function toCsvZip(snapshot: Snapshot, info: ExportInfo): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const spec of TABLE_SPECS) {
    const names = spec.columns.map((c) => c.name);
    const rows = tableRows(snapshot, spec.key).map((r) => names.map((c) => r[c]));
    zip.file(`${spec.sheet}.csv`, csv(names, rows));
  }
  zip.file('Settings.csv', csv(['key', 'value'], settingsEntries(snapshot.settings)));
  zip.file(
    '_Meta.csv',
    csv(['key', 'value'], [
      ['schemaVersion', snapshot.schemaVersion],
      ['appVersion', info.appVersion],
      ['exportedAt', info.exportedAt],
      ['format', 'trek-csv'],
    ]),
  );
  return zip.generateAsync({ type: 'uint8array' });
}
