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

// Patterns that suggest a "total" row
const TOTAL_PATTERNS = /^(total|subtotal|soma|saldo|resultado|líquido|bruto|consolidado)/i;

// Patterns that suggest monetary columns
const MONETARY_PATTERNS = /^(r\$|us\$|eur|valor|saldo|receita|custo|despesa|lucro|resultado|débito|crédito|imposto|icms|iss|pis|cofins|irpj|csll|faturamento|pagamento)/i;

function isNumeric(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'string') {
    // Brazilian number format: 1.234,56 or -1.234,56
    const cleaned = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return !isNaN(Number(cleaned)) && cleaned.length > 0;
  }
  return false;
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return Number(cleaned);
  }
  return 0;
}

interface ColumnAnalysis {
  index: number;
  header: string;
  numeric_count: number;
  total_count: number;
  is_monetary: boolean;
  min: number | null;
  max: number | null;
  sum: number;
}

function analyzeColumns(headers: string[], dataRows: unknown[][]): ColumnAnalysis[] {
  const analyses: ColumnAnalysis[] = headers.map((header, index) => ({
    index,
    header,
    numeric_count: 0,
    total_count: dataRows.length,
    is_monetary: MONETARY_PATTERNS.test(header),
    min: null,
    max: null,
    sum: 0,
  }));

  for (const row of dataRows) {
    for (let i = 0; i < analyses.length; i++) {
      const val = row[i];
      if (isNumeric(val)) {
        const num = toNumber(val);
        analyses[i].numeric_count++;
        analyses[i].sum += num;
        if (analyses[i].min === null || num < analyses[i].min!) analyses[i].min = num;
        if (analyses[i].max === null || num > analyses[i].max!) analyses[i].max = num;

        // If column has large values, likely monetary
        if (Math.abs(num) > 100) {
          analyses[i].is_monetary = true;
        }
      }
    }
  }

  return analyses;
}

function detectTotalRows(headers: string[], dataRows: unknown[][]): number[] {
  const totalRowIndices: number[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const firstCell = String(dataRows[i][0] ?? '').trim();
    if (TOTAL_PATTERNS.test(firstCell)) {
      totalRowIndices.push(i);
    }
  }
  return totalRowIndices;
}

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

      // Enhanced analysis
      const columnAnalysis = analyzeColumns(headers, dataRows.slice(0, MAX_SAMPLE_ROWS));
      const totalRowIndices = detectTotalRows(headers, dataRows.slice(0, MAX_SAMPLE_ROWS));

      const numericColumns = columnAnalysis
        .filter(c => c.numeric_count > c.total_count * 0.5)
        .map(c => ({
          header: c.header,
          is_monetary: c.is_monetary,
          min: c.min,
          max: c.max,
          sum: Math.round(c.sum * 100) / 100,
        }));

      const sheetData: SheetData = {
        sheet_name: sheetName,
        column_count: headers.length,
        row_count: dataRows.length,
        columns: headers,
        rows_preview: dataRows.slice(0, MAX_PREVIEW_ROWS),
        rows_sample: dataRows.slice(0, MAX_SAMPLE_ROWS),
      };

      // Add enhanced metadata
      (sheetData as Record<string, unknown>).numeric_columns = numericColumns;
      (sheetData as Record<string, unknown>).total_row_indices = totalRowIndices;
      (sheetData as Record<string, unknown>).has_financial_data = numericColumns.some(c => c.is_monetary);

      sheets.push(sheetData);
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
