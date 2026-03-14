import type { DocumentWithExtraction, AnalysisPayload, AnalysisDocumentPayload } from '@/types/documents';

export function buildAnalysisPayload(documents: DocumentWithExtraction[]): AnalysisPayload {
  const validDocs = documents.filter(
    d => d.extraction && d.extraction.extraction_status === 'extracted'
  );

  const payloadDocs: AnalysisDocumentPayload[] = validDocs.map(doc => {
    const ext = doc.extraction!;
    const sourceType = doc.file_type;

    if (sourceType === 'xlsx' && ext.extracted_json) {
      return {
        document_name: doc.file_name,
        source_type: 'xlsx',
        detected_document_type: ext.detected_type || 'unknown',
        content: {
          metadata: {
            sheet_count: (ext.extracted_json as any).sheetCount || 0,
          },
          sheets: (ext.extracted_json as any).sheets || [],
        },
      };
    }

    if (sourceType === 'csv' && ext.extracted_json) {
      return {
        document_name: doc.file_name,
        source_type: 'csv',
        detected_document_type: ext.detected_type || 'unknown',
        content: {
          metadata: {
            row_count: (ext.extracted_json as any).rowCount || 0,
            columns: (ext.extracted_json as any).columns || [],
            delimiter: (ext.extracted_json as any).delimiter || ',',
          },
          text_preview: ext.preview_text,
          full_text: ext.extracted_text || undefined,
        },
      };
    }

    // PDF or other text-based
    return {
      document_name: doc.file_name,
      source_type: sourceType,
      detected_document_type: ext.detected_type || 'unknown',
      content: {
        text_preview: ext.preview_text,
        full_text: ext.extracted_text || undefined,
      },
    };
  });

  return {
    analysis_request: {
      goal: 'analisar documentos empresariais e gerar relatório executivo',
      language: 'pt-BR',
    },
    documents: payloadDocs,
  };
}
