import { buildPocWorkbook, POC_EXPECTED } from '../workbookPoc';
import { inspectWorkbook, type SheetReport } from '../readBack';

const ALLOWED = new Set(['COUNTIFS', 'SUMIFS', 'AVERAGEIFS', 'IFERROR', 'IF', 'MAX', 'MIN']);
const FORBIDDEN = /\b(FILTER|LET|XLOOKUP|SORT|UNIQUE|SEQUENCE)\s*\(/i;

function functionsIn(formula: string): string[] {
  return [...formula.matchAll(/([A-Z][A-Z0-9.]*)\s*\(/g)].map((m) => m[1]!);
}

describe('xlsx proof of concept', () => {
  let sheets: Map<string, SheetReport>;
  let meta: Record<string, string>;
  let rawParts: string[];

  beforeAll(async () => {
    const bytes = await buildPocWorkbook();
    expect(bytes).toBeInstanceOf(Uint8Array);
    const report = await inspectWorkbook(bytes);
    sheets = new Map(report.sheets.map((s) => [s.name, s]));
    meta = report.meta;
    rawParts = report.rawSheetXml;
  });

  it('has the expected sheets', () => {
    expect([...sheets.keys()]).toEqual(['Dashboard', 'Logs', '_Meta']);
  });

  it('Dashboard formulas use only allowed functions and carry cached values', () => {
    const dash = sheets.get('Dashboard')!;
    const formulaCells = dash.cells.filter((c) => c.formula !== undefined);
    expect(formulaCells.length).toBe(POC_EXPECTED.length);
    const used = new Set<string>();
    for (const exp of POC_EXPECTED) {
      const cell = dash.cells.find((c) => c.ref === exp.ref)!;
      expect(cell.formula).toBeDefined();
      expect(cell.formula).not.toMatch(FORBIDDEN);
      for (const fn of functionsIn(cell.formula!)) {
        expect(ALLOWED.has(fn)).toBe(true);
        used.add(fn);
      }
      expect(cell.cached).toBeCloseTo(exp.value, 10);
    }
    for (const fn of ['COUNTIFS', 'SUMIFS', 'AVERAGEIFS', 'IFERROR']) {
      expect(used.has(fn)).toBe(true);
    }
  });

  it('ID, date and time cells are TEXT with string values', () => {
    const logs = sheets.get('Logs')!;
    const body = logs.cells.filter((c) => c.row > 1 && [1, 2, 3, 4].includes(c.col));
    expect(body.length).toBeGreaterThan(0);
    for (const c of body) {
      expect(c.format).toBe('@');
      expect(typeof c.value).toBe('string');
    }
    const dash = sheets.get('Dashboard')!;
    for (const c of dash.cells.filter((x) => x.row > 1 && x.col === 1)) {
      expect(c.format).toBe('@');
      expect(typeof c.value).toBe('string');
    }
  });

  it('has a dataBar and a colorScale rule', () => {
    const types = [...sheets.values()].flatMap((s) => s.conditionalFormats);
    expect(types).toContain('dataBar');
    expect(types).toContain('colorScale');
    const xml = rawParts.join('\n');
    expect(xml).toMatch(/<conditionalFormatting[^>]*sqref="B2:B4"[^>]*>\s*<cfRule[^>]*type="dataBar"[^>]*>\s*<dataBar>\s*<cfvo type="min"\/>\s*<cfvo type="max"\/>\s*<color rgb="FF4F7CAC"\/>/);
    expect(xml).toMatch(/<cfRule[^>]*type="colorScale"[^>]*>\s*<colorScale>\s*<cfvo type="min"\/>\s*<cfvo type="max"\/>\s*<color rgb="FFF2F2F2"\/>\s*<color rgb="FF4F7CAC"\/>/);
  });

  it('freezes row 1 on every data sheet', () => {
    for (const name of ['Dashboard', 'Logs']) {
      const s = sheets.get(name)!;
      expect(s.pane).toEqual({ state: 'frozen', ySplit: 1, xSplit: 0 });
    }
  });

  it('protects every sheet without a password', () => {
    for (const s of sheets.values()) {
      expect(s.protected).toBe(true);
      expect(s.passwordHash).toBe(false);
    }
    for (const xml of rawParts) {
      expect(xml).toMatch(/<sheetProtection[^>]*sheet="1"/);
      expect(xml).not.toMatch(/hashValue|saltValue|algorithmName|password=/);
    }
  });

  it('_Meta has format trek-xlsx and no emoji anywhere', () => {
    expect(meta.format).toBe('trek-xlsx');
    expect(meta.schemaVersion).toBeDefined();
    const all = [...sheets.values()].flatMap((s) => s.cells.map((c) => String(c.value ?? '')));
    for (const t of all) expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
