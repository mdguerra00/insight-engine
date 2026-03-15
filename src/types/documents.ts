export type UploadStatus = 'uploading' | 'uploaded' | 'error';
export type ExtractionStatus = 'pending' | 'extracting' | 'extracted' | 'low_content' | 'failed';

export interface DocumentFile {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  storage_path: string;
  upload_status: UploadStatus;
  created_at: string;
}

export interface SheetData {
  sheet_name: string;
  column_count: number;
  row_count: number;
  columns: string[];
  rows_preview: unknown[][];
  rows_sample: unknown[][];
  numeric_columns?: Array<{ header: string; is_monetary: boolean; min: number | null; max: number | null; sum: number }>;
  total_row_indices?: number[];
  has_financial_data?: boolean;
}

export interface ExtractionResult {
  id: string;
  document_id: string;
  extraction_status: ExtractionStatus;
  detected_type: string;
  preview_text: string;
  extracted_text: string | null;
  extracted_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalysisReport {
  id: string;
  report_text: string;
  report_json: Record<string, unknown> | null;
  created_at: string;
}

export interface DocumentWithExtraction extends DocumentFile {
  extraction?: ExtractionResult;
}

export interface AnalysisPayload {
  analysis_request: {
    goal: string;
    language: string;
  };
  documents: AnalysisDocumentPayload[];
}

export interface AnalysisDocumentPayload {
  document_name: string;
  source_type: string;
  detected_document_type: string;
  content: {
    text_preview?: string;
    full_text?: string;
    metadata?: Record<string, unknown>;
    sheets?: SheetData[];
  };
}
