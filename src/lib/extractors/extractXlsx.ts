import * as XLSX from 'xlsx';
import type { SheetData } from '@/types/documents';

export interface XlsxExtractionResult {
  status: 'extracted' | 'low_content' | 'failed';
  preview: string;
  sheets: SheetData[];
  sheetCount: number;
  error?: string;
}

const MAX_SAMPLE_ROWS = 100;
const MAX_PREVIEW_ROWS = 5;

export async function extractXlsx(file: File): Promise<XlsxExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return {
        status: 'low_content',
        preview: '(Planilha sem abas)',
        sheets: [],
        sheetCount: 0,
      };
    }

    const sheets: SheetData[] = [];
    let totalRows = 0;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 }) as unknown[][];

      if (!jsonData.length) {
        sheets.push({
          sheet_name: sheetName,
          column_count: 0,
          row_count: 0,
          columns: [],
          rows_preview: [],
          rows_sample: [],
        });
        continue;
      }

      const headers = (jsonData[0] as unknown[]).map(h => String(h ?? ''));
      const dataRows = jsonData.slice(1);
      totalRows += dataRows.length;

      sheets.push({
        sheet_name: sheetName,
        column_count: headers.length,
        row_count: dataRows.length,
        columns: headers,
        rows_preview: dataRows.slice(0, MAX_PREVIEW_ROWS),
        rows_sample: dataRows.slice(0, MAX_SAMPLE_ROWS),
      });
    }

    if (totalRows === 0) {
      return {
        status: 'low_content',
        preview: '(Planilha sem dados)',
        sheets,
        sheetCount: workbook.SheetNames.length,
      };
    }

    const previewLines = sheets
      .map(s => `[${s.sheet_name}] ${s.row_count} linhas, ${s.column_count} colunas: ${s.columns.join(', ')}`)
      .join('\n');

    return {
      status: 'extracted',
      preview: previewLines.slice(0, 500),
      sheets,
      sheetCount: workbook.SheetNames.length,
    };
  } catch (error) {
    return {
      status: 'failed',
      preview: '',
      sheets: [],
      sheetCount: 0,
      error: error instanceof Error ? error.message : 'Erro ao extrair XLSX',
    };
  }
}
