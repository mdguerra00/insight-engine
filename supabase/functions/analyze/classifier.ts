// ─────────────────────────────────────────────────────────────────
// Phase 3 — Document Classifier
// Classifies documents by content, not by file extension.
// ─────────────────────────────────────────────────────────────────

import { CLASSIFIER_PROMPT } from "./prompts.ts";

export interface DocumentClassification {
  document_name: string;
  document_class: string;
  confidence: number;
  secondary_classes: string[];
  period_detected: string | null;
  entity_detected: string | null;
  contains_financial_values: boolean;
  contains_tax_data: boolean;
  reasoning: string;
}

interface ClassifierResponse {
  classifications: DocumentClassification[];
}

interface DocumentPayload {
  document_name: string;
  source_type: string;
  content: Record<string, unknown>;
}

interface LlmClient {
  generateJson<T>(params: {
    messages: { role: string; content: string }[];
    model?: string;
  }): Promise<T>;
  models: { extraction: string; report: string };
}

export async function classifyDocuments(
  documents: DocumentPayload[],
  llmClient: LlmClient
): Promise<DocumentClassification[]> {
  // Build a summarized view of each document for classification
  const docSummaries = documents.map((doc) => {
    const summary: Record<string, unknown> = {
      document_name: doc.document_name,
      source_type: doc.source_type,
    };

    const content = doc.content as Record<string, unknown>;

    if (content.sheets && Array.isArray(content.sheets)) {
      summary.sheets = (content.sheets as Array<Record<string, unknown>>).map(
        (s) => ({
          sheet_name: s.sheet_name,
          columns: s.columns,
          row_count: s.row_count,
          sample_rows: (s.rows_preview || s.rows_sample || []) as unknown[][],
        })
      );
    } else if (content.full_text) {
      // For PDFs/CSVs, send first 3000 chars for classification
      const text = String(content.full_text);
      summary.text_excerpt = text.slice(0, 3000);
    } else if (content.text_preview) {
      summary.text_excerpt = content.text_preview;
    }

    return summary;
  });

  const userMessage = `Classifique os seguintes ${documents.length} documento(s):

${JSON.stringify(docSummaries, null, 2)}`;

  const result = await llmClient.generateJson<ClassifierResponse>({
    messages: [
      { role: "system", content: CLASSIFIER_PROMPT },
      { role: "user", content: userMessage },
    ],
    model: llmClient.models.extraction,
  });

  // Ensure every document has a classification, even if LLM missed some
  const classifiedNames = new Set(
    result.classifications.map((c) => c.document_name)
  );

  for (const doc of documents) {
    if (!classifiedNames.has(doc.document_name)) {
      result.classifications.push({
        document_name: doc.document_name,
        document_class: "desconhecido",
        confidence: 0,
        secondary_classes: [],
        period_detected: null,
        entity_detected: null,
        contains_financial_values: false,
        contains_tax_data: false,
        reasoning:
          "Documento não foi classificado pelo modelo — classificação padrão aplicada.",
      });
    }
  }

  return result.classifications;
}
