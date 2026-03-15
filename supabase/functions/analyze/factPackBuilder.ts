// ─────────────────────────────────────────────────────────────────
// Phase 4 — Fact Pack Builder
// Extracts structured financial facts from classified documents.
// ─────────────────────────────────────────────────────────────────

import { FACT_EXTRACTOR_PROMPT } from "./prompts.ts";
import type { DocumentClassification } from "./classifier.ts";

export interface FinancialFact {
  label: string;
  value: number;
  unit: string;
  period: string | null;
  source: string;
  confidence: number;
  subcategory: string;
}

export interface ReconciliationCandidate {
  description: string;
  left_label: string;
  left_value: number;
  right_label: string;
  right_value: number;
  difference: number;
  status: string;
}

export interface DocumentInventoryItem {
  document_name: string;
  document_class: string;
  period: string | null;
  entity: string | null;
  quality_assessment: string;
}

export interface FactPack {
  document_inventory: DocumentInventoryItem[];
  facts: {
    revenue: FinancialFact[];
    cogs: FinancialFact[];
    expenses: FinancialFact[];
    taxes: FinancialFact[];
    assets: FinancialFact[];
    liabilities: FinancialFact[];
    equity: FinancialFact[];
    cash: FinancialFact[];
    headcount: FinancialFact[];
    indicators: FinancialFact[];
    other: FinancialFact[];
  };
  reconciliation_candidates: ReconciliationCandidate[];
  periods_found: string[];
  entities_found: string[];
  gaps: string[];
  warnings: string[];
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

const EMPTY_FACT_PACK: FactPack = {
  document_inventory: [],
  facts: {
    revenue: [],
    cogs: [],
    expenses: [],
    taxes: [],
    assets: [],
    liabilities: [],
    equity: [],
    cash: [],
    headcount: [],
    indicators: [],
    other: [],
  },
  reconciliation_candidates: [],
  periods_found: [],
  entities_found: [],
  gaps: ["Nenhum fato financeiro pôde ser extraído dos documentos."],
  warnings: [],
};

export async function buildFactPack(
  documents: DocumentPayload[],
  classifications: DocumentClassification[],
  llmClient: LlmClient
): Promise<FactPack> {
  // Merge document content with their classifications
  const classMap = new Map(
    classifications.map((c) => [c.document_name, c])
  );

  const MAX_CONTENT_CHARS = 80_000;

  const enrichedDocs = documents.map((doc) => {
    const cls = classMap.get(doc.document_name);
    let content: Record<string, unknown> = doc.content;

    // Truncate large document content to avoid LLM timeout
    const contentStr = JSON.stringify(content);
    if (contentStr.length > MAX_CONTENT_CHARS) {
      // Truncate text fields within the content instead of slicing raw JSON
      const truncated: Record<string, unknown> = {};
      let budget = MAX_CONTENT_CHARS;
      for (const [key, val] of Object.entries(content)) {
        const valStr = JSON.stringify(val);
        if (budget <= 0) break;
        if (valStr.length > budget) {
          truncated[key] = typeof val === "string"
            ? val.slice(0, budget) + "… [TRUNCADO]"
            : val;
          budget = 0;
        } else {
          truncated[key] = val;
          budget -= valStr.length;
        }
      }
      truncated._truncated = true;
      truncated._original_size_chars = contentStr.length;
      content = truncated;
    }

    return {
      document_name: doc.document_name,
      source_type: doc.source_type,
      classification: cls
        ? {
            document_class: cls.document_class,
            period_detected: cls.period_detected,
            entity_detected: cls.entity_detected,
          }
        : { document_class: "desconhecido" },
      content,
    };
  });

  const userMessage = `Extraia todos os fatos financeiros dos seguintes ${documents.length} documento(s) classificados:

${JSON.stringify(enrichedDocs)}`;

  try {
    const result = await llmClient.generateJson<FactPack>({
      messages: [
        { role: "system", content: FACT_EXTRACTOR_PROMPT },
        { role: "user", content: userMessage },
      ],
      model: llmClient.models.extraction,
    });

    // Ensure all required fields exist
    return {
      document_inventory: result.document_inventory || [],
      facts: {
        revenue: result.facts?.revenue || [],
        cogs: result.facts?.cogs || [],
        expenses: result.facts?.expenses || [],
        taxes: result.facts?.taxes || [],
        assets: result.facts?.assets || [],
        liabilities: result.facts?.liabilities || [],
        equity: result.facts?.equity || [],
        cash: result.facts?.cash || [],
        headcount: result.facts?.headcount || [],
        indicators: result.facts?.indicators || [],
        other: result.facts?.other || [],
      },
      reconciliation_candidates: result.reconciliation_candidates || [],
      periods_found: result.periods_found || [],
      entities_found: result.entities_found || [],
      gaps: result.gaps || [],
      warnings: result.warnings || [],
    };
  } catch (error) {
    console.error("Fact pack extraction failed:", error);
    return {
      ...EMPTY_FACT_PACK,
      warnings: [
        `Erro na extração de fatos: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
