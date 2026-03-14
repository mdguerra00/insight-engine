export interface CsvExtractionResult {
  status: 'extracted' | 'low_content' | 'failed';
  preview: string;
  columns: string[];
  rowCount: number;
  rowsSample: string[][];
  delimiter: string;
  error?: string;
}

const MAX_SAMPLE_ROWS = 100;
const MAX_PREVIEW_ROWS = 5;

function detectDelimiter(text: string): string {
  const firstLines = text.split('\n').slice(0, 5).join('\n');
  const counts: Record<string, number> = {
    ',': (firstLines.match(/,/g) || []).length,
    ';': (firstLines.match(/;/g) || []).length,
    '\t': (firstLines.match(/\t/g) || []).length,
  };
  
  let best = ',';
  let max = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = delim;
    }
  }
  return best;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function extractCsv(file: File): Promise<CsvExtractionResult> {
  try {
    const text = await file.text();
    
    if (!text.trim()) {
      return {
        status: 'low_content',
        preview: '(Arquivo CSV vazio)',
        columns: [],
        rowCount: 0,
        rowsSample: [],
        delimiter: ',',
      };
    }

    const delimiter = detectDelimiter(text);
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return {
        status: 'low_content',
        preview: lines[0] || '(CSV sem dados)',
        columns: lines[0] ? parseCsvLine(lines[0], delimiter) : [],
        rowCount: 0,
        rowsSample: [],
        delimiter,
      };
    }

    const columns = parseCsvLine(lines[0], delimiter);
    const dataLines = lines.slice(1);
    const rowsSample = dataLines.slice(0, MAX_SAMPLE_ROWS).map(l => parseCsvLine(l, delimiter));
    const rowsPreview = rowsSample.slice(0, MAX_PREVIEW_ROWS);

    const previewText = `${dataLines.length} linhas, ${columns.length} colunas: ${columns.join(', ')}\n\n` +
      rowsPreview.map(r => r.join(' | ')).join('\n');

    return {
      status: 'extracted',
      preview: previewText.slice(0, 500),
      columns,
      rowCount: dataLines.length,
      rowsSample,
      delimiter,
    };
  } catch (error) {
    return {
      status: 'failed',
      preview: '',
      columns: [],
      rowCount: 0,
      rowsSample: [],
      delimiter: ',',
      error: error instanceof Error ? error.message : 'Erro ao extrair CSV',
    };
  }
}
