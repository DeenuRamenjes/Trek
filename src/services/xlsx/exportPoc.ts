import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildPocWorkbook } from './workbookPoc';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLSX_UTI = 'org.openxmlformats.spreadsheetml.sheet';

/** Builds the proof-of-concept workbook, saves it to the cache dir and opens the share sheet. */
export async function exportPocXlsx(): Promise<string> {
  const bytes = await buildPocWorkbook();
  const file = new File(Paths.cache, 'trek-poc.xlsx');
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, UTI: XLSX_UTI, dialogTitle: 'trek-poc.xlsx' });
  return file.uri;
}
