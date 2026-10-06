import '../xlsx/textCodec';
import JSZip from 'jszip';
import { fromArrayBuffer, loadWorkbook } from '@office-kit/xlsx/io';
import { iterWorksheets } from '@office-kit/xlsx/workbook';
import { iterCells, type Worksheet } from '@office-kit/xlsx/worksheet';
import { getCachedFormulaValue, isErrorValue, isFormulaValue, isRichTextValue, cellValueAsString } from '@office-kit/xlsx/cell';
import { parseSettings } from '../../domain/settings';
import { JSON_FORMAT, parseJson, type BackupMeta } from './jsonBackup';
import { exportableSettings, TABLE_SPECS, type ColumnSpec, type ExportedSettings, type RawRow, type TableKey, type TableSpec } from './snapshot';

export type ImportFormat = 'xlsx' | 'json' | 'csv';

export type ParsedImport = {
  format: ImportFormat;
  meta: BackupMeta;
  /** Rows by table, columns by header name, values coerced. Missing sheets are empty. */
  tables: Record<TableKey, RawRow[]>;
  /** Source row number per row (1-based; the header is row 1 in sheets and CSV files). */
  rowNumbers: Record<TableKey, number[]>;
  settings: ExportedSettings;
};

export class ImportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportFormatError';
  }
}

const EXPECTED_FORMAT: Record<ImportFormat, string> = { xlsx: 'trek-xlsx', json: JSON_FORMAT, csv: 'trek-csv' };

const DATE_COLUMNS = new Set(['startDate', 'endDate', 'effectiveFrom', 'date']);
const TIME_COLUMNS = new Set(['time']);
const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt', 'loggedAt', 'pausedAt', 'archivedAt']);

const EXCEL_EPOCH_OFFSET_DAYS = 25569; // 1899-12-30 -> 1970-01-01
const DAY_MS = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function serialToDate(serial: number): Date {
  return new Date(Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * DAY_MS));
}

function dateToYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function minutesToHhmm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

function toTime(v: unknown): unknown {
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  const n = typeof v === 'number' ? v : typeof v === 'string' && NUMERIC.test(v.trim()) ? Number(v) : undefined;
  if (n !== undefined) return minutesToHhmm((n - Math.floor(n)) * 1440);
  if (typeof v === 'string') {
    const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(v.trim());
    if (m) return `${pad(Number(m[1]))}:${m[2]}`;
  }
  return v;
}

function toDate(v: unknown): unknown {
  if (v instanceof Date) return dateToYmd(v);
  const n = typeof v === 'number' ? v : typeof v === 'string' && NUMERIC.test(v.trim()) ? Number(v) : undefined;
  if (n !== undefined && n >= 1) return dateToYmd(serialToDate(Math.floor(n)));
  if (typeof v === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(v.trim());
    if (m) return m[1];
  }
  return v;
}

function toTimestamp(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number' && v > 1) return serialToDate(v).toISOString();
  if (typeof v === 'string' && /^\d+\.\d+$/.test(v.trim())) return serialToDate(Number(v)).toISOString();
  return v;
}

function toBoolean(v: unknown): unknown {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return v;
}

function toNumber(v: unknown): unknown {
  if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v);
  return v;
}

function toText(v: unknown): unknown {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v;
}

/** Coerces one cell to the shape the zod row schemas expect. Blank becomes null. */
export function coerceValue(column: ColumnSpec, v: unknown): unknown {
  if (isBlank(v)) return null;
  if (TIME_COLUMNS.has(column.name)) return toTime(v);
  if (DATE_COLUMNS.has(column.name)) return toDate(v);
  if (TIMESTAMP_COLUMNS.has(column.name)) return toTimestamp(v);
  if (column.kind === 'boolean') return toBoolean(v);
  if (column.kind === 'number') return toNumber(v);
  return toText(v);
}

function emptyTables<T>(make: () => T): Record<TableKey, T> {
  return Object.fromEntries(TABLE_SPECS.map((s) => [s.key, make()])) as Record<TableKey, T>;
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Rows of a header-first grid (row numbers are 1-based, grid[0] is row 1). Columns match by header name. */
function gridToRows(spec: TableSpec, grid: unknown[][], firstRowNumber = 1): { rows: RawRow[]; numbers: number[] } {
  const rows: RawRow[] = [];
  const numbers: number[] = [];
  const header = grid[0] ?? [];
  const index = new Map<string, number>();
  header.forEach((h, i) => {
    const key = norm(h);
    if (key && !index.has(key)) index.set(key, i);
  });
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] ?? [];
    if (line.every(isBlank)) continue;
    const row: RawRow = {};
    for (const col of spec.columns) {
      const at = index.get(col.name.toLowerCase());
      row[col.name] = coerceValue(col, at === undefined ? null : line[at]);
    }
    rows.push(row);
    numbers.push(firstRowNumber + r);
  }
  return { rows, numbers };
}

/** Settings key/value pairs back to typed settings. Objects were written as JSON text. */
function settingsFromEntries(entries: [string, unknown][]): ExportedSettings {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of entries) {
    if (isBlank(k)) continue;
    const key = String(k).trim();
    let value: unknown = typeof v === 'string' ? v : v ?? null;
    if (typeof value === 'string') {
      const t = value.trim();
      if (t === 'null' || t.startsWith('{') || t.startsWith('[')) {
        try {
          value = JSON.parse(t);
        } catch {
          // keep the text; parseSettings drops invalid values
        }
      } else if (t === 'true' || t === 'false') value = t === 'true';
      else if (NUMERIC.test(t) && key !== 'accentColor') value = Number(t);
    }
    if (value !== null) raw[key] = value;
    else if (key === 'quietHours') raw[key] = null;
  }
  return exportableSettings(parseSettings(raw));
}

function metaFrom(entries: [string, unknown][], format: ImportFormat): BackupMeta {
  const m = new Map(entries.map(([k, v]) => [norm(k), v]));
  const version = Number(m.get('schemaversion'));
  if (!m.size) throw new ImportFormatError('Not a Trek backup: _Meta is missing');
  if (norm(m.get('format')) !== EXPECTED_FORMAT[format]) throw new ImportFormatError('Not a Trek backup: unexpected format');
  if (!Number.isFinite(version)) throw new ImportFormatError('Backup has no schemaVersion');
  return {
    format: EXPECTED_FORMAT[format],
    schemaVersion: version,
    appVersion: String(m.get('appversion') ?? ''),
    exportedAt: String(m.get('exportedat') ?? ''),
  };
}

function build(
  format: ImportFormat,
  meta: BackupMeta,
  grids: Map<string, unknown[][]>,
  settingsEntries: [string, unknown][],
): ParsedImport {
  const tables = emptyTables<RawRow[]>(() => []);
  const rowNumbers = emptyTables<number[]>(() => []);
  for (const spec of TABLE_SPECS) {
    const grid = grids.get(norm(spec.sheet));
    if (!grid) continue;
    const { rows, numbers } = gridToRows(spec, grid);
    tables[spec.key] = rows;
    rowNumbers[spec.key] = numbers;
  }
  return { format, meta, tables, rowNumbers, settings: settingsFromEntries(settingsEntries) };
}

function keyValueEntries(grid: unknown[][] | undefined): [string, unknown][] {
  if (!grid) return [];
  const header = (grid[0] ?? []).map(norm);
  const k = header.indexOf('key') === -1 ? 0 : header.indexOf('key');
  const v = header.indexOf('value') === -1 ? 1 : header.indexOf('value');
  return grid
    .slice(1)
    .filter((line) => !isBlank(line[k]))
    .map((line) => [String(line[k]).trim(), line[v] ?? null]);
}

// ---------- xlsx ----------

function cellPrimitive(c: Parameters<typeof getCachedFormulaValue>[0]): unknown {
  const v = c.value;
  if (v === null || v === undefined) return null;
  if (isFormulaValue(v)) return getCachedFormulaValue(c) ?? null;
  if (isErrorValue(v)) return null;
  if (isRichTextValue(v)) return cellValueAsString(v);
  return v;
}

async function parseXlsx(bytes: Uint8Array): Promise<ParsedImport> {
  let wb;
  try {
    wb = await loadWorkbook(fromArrayBuffer(bytes));
  } catch {
    throw new ImportFormatError('Could not read the spreadsheet');
  }
  const grids = new Map<string, unknown[][]>();
  for (const ws of iterWorksheets(wb) as Iterable<Worksheet>) {
    const grid: unknown[][] = [];
    for (const c of iterCells(ws)) {
      const value = cellPrimitive(c);
      if (value === null) continue;
      (grid[c.row - 1] ??= [])[c.col - 1] = value;
    }
    for (let i = 0; i < grid.length; i++) grid[i] ??= [];
    grids.set(norm(ws.title), grid);
  }
  const meta = metaFrom(keyValueEntries(grids.get('_meta')), 'xlsx');
  return build('xlsx', meta, grids, keyValueEntries(grids.get('settings')));
}

// ---------- csv ----------

/** RFC 4180 parser: quoted fields, doubled quotes, CR/LF/CRLF, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let touched = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
      touched = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      touched = true;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      if (touched || field !== '') {
        row.push(field);
        out.push(row);
      }
      row = [];
      field = '';
      touched = false;
    } else {
      field += ch;
      touched = true;
    }
  }
  if (touched || field !== '') {
    row.push(field);
    out.push(row);
  }
  return out;
}

async function parseCsvZip(zip: JSZip): Promise<ParsedImport> {
  const grids = new Map<string, unknown[][]>();
  for (const name of Object.keys(zip.files)) {
    const m = /(?:^|\/)([^/]+)\.csv$/i.exec(name);
    if (!m || zip.files[name]!.dir) continue;
    grids.set(norm(m[1]), parseCsv(await zip.files[name]!.async('string')));
  }
  const meta = metaFrom(keyValueEntries(grids.get('_meta')), 'csv');
  return build('csv', meta, grids, keyValueEntries(grids.get('settings')));
}

// ---------- json ----------

function parseJsonImport(text: string): ParsedImport {
  let parsed;
  try {
    parsed = parseJson(text);
  } catch (e) {
    throw new ImportFormatError((e as Error).message);
  }
  const tables = emptyTables<RawRow[]>(() => []);
  const rowNumbers = emptyTables<number[]>(() => []);
  const source = parsed.snapshot.tables as unknown as Record<string, unknown>;
  for (const spec of TABLE_SPECS) {
    const rows = source[spec.key];
    if (!Array.isArray(rows)) continue;
    tables[spec.key] = rows.map((r) => {
      const src = (r ?? {}) as RawRow;
      return Object.fromEntries(spec.columns.map((c) => [c.name, coerceValue(c, src[c.name])]));
    });
    rowNumbers[spec.key] = rows.map((_, i) => i + 1);
  }
  const settings = exportableSettings(parseSettings(parsed.snapshot.settings));
  return { format: 'json', meta: parsed.meta, tables, rowNumbers, settings };
}

/**
 * Reads an xlsx, JSON or CSV zip backup. The format is detected from the content.
 * Only the raw sheets, Settings and _Meta are read. Throws ImportFormatError for files that are not Trek backups.
 */
export async function parseImport(input: Uint8Array | string): Promise<ParsedImport> {
  if (typeof input === 'string') return parseJsonImport(input);
  const isZip = input.length > 3 && input[0] === 0x50 && input[1] === 0x4b;
  if (!isZip) return parseJsonImport(new TextDecoder('utf-8').decode(input));
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    throw new ImportFormatError('Could not read the file');
  }
  if (zip.file('[Content_Types].xml')) return parseXlsx(input);
  return parseCsvZip(zip);
}
