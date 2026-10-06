import './textCodec';
import { loadWorkbook, fromArrayBuffer } from '@office-kit/xlsx/io';
import { iterWorksheets } from '@office-kit/xlsx/workbook';
import { iterCells, type Worksheet } from '@office-kit/xlsx/worksheet';
import { getFormulaText, getCachedFormulaValue, isFormulaValue, isEmptyCell } from '@office-kit/xlsx/cell';
import { getCellNumberFormat } from '@office-kit/xlsx/styles';
import JSZip from 'jszip';

export type CellReport = {
  ref: string;
  row: number;
  col: number;
  value: string | number | boolean | null;
  formula?: string;
  cached?: number | string | boolean;
  format: string;
};

export type SheetReport = {
  name: string;
  cells: CellReport[];
  conditionalFormats: string[];
  pane?: { state: string; xSplit: number; ySplit: number };
  protected: boolean;
  passwordHash: boolean;
};

export type WorkbookReport = {
  sheets: SheetReport[];
  meta: Record<string, string>;
  rawSheetXml: string[];
};

function colName(n: number): string {
  let s = '';
  for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
}

export async function inspectWorkbook(bytes: Uint8Array): Promise<WorkbookReport> {
  const wb = await loadWorkbook(fromArrayBuffer(bytes));
  const sheets: SheetReport[] = [];
  for (const ws of iterWorksheets(wb) as Iterable<Worksheet>) {
    const cells: CellReport[] = [];
    for (const c of iterCells(ws)) {
      if (isEmptyCell(c)) continue;
      const r: CellReport = {
        ref: `${colName(c.col)}${c.row}`,
        row: c.row,
        col: c.col,
        value: isFormulaValue(c.value) ? null : (c.value as string | number | boolean | null),
        format: getCellNumberFormat(wb, c),
      };
      if (isFormulaValue(c.value)) {
        const f = getFormulaText(c);
        const v = getCachedFormulaValue(c);
        if (f !== undefined) r.formula = f;
        if (v !== undefined) r.cached = v;
      }
      cells.push(r);
    }
    const pane = ws.views[0]?.pane;
    const prot = ws.sheetProtection;
    const report: SheetReport = {
      name: ws.title,
      cells,
      conditionalFormats: ws.conditionalFormatting.flatMap((cf) => cf.rules.map((r) => r.type)),
      protected: prot?.sheet === true,
      passwordHash: Boolean(prot?.hashValue),
    };
    if (pane) report.pane = { state: pane.state, xSplit: pane.xSplit ?? 0, ySplit: pane.ySplit ?? 0 };
    sheets.push(report);
  }

  const metaSheet = sheets.find((s) => s.name === '_Meta');
  const meta: Record<string, string> = {};
  if (metaSheet) {
    for (const c of metaSheet.cells) {
      if (c.col === 1 && c.row > 1) {
        const v = metaSheet.cells.find((x) => x.row === c.row && x.col === 2);
        meta[String(c.value)] = String(v?.value ?? '');
      }
    }
  }

  const zip = await JSZip.loadAsync(bytes);
  const rawSheetXml: string[] = [];
  for (const name of Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
    rawSheetXml.push(await zip.files[name]!.async('string'));
  }
  return { sheets, meta, rawSheetXml };
}
