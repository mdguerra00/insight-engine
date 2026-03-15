// ─────────────────────────────────────────────────────────────────
// Phase 7 — Financial Auditor
// Reviews the draft report critically against the fact pack.
// ─────────────────────────────────────────────────────────────────

import { AUDITOR_PROMPT } from "./prompts.ts";
import type { FactPack } from "./factPackBuilder.ts";
import type { FinancialEngineResult } from "./financialEngine.ts";

export interface AuditIssue {
  severity: "critical" | "major" | "minor";
  category: string;
  description: string;
  location: string;
  suggestion: string;
}

export interface AuditResult {
  issues: AuditIssue[];
  strengths: string[];
  missing_analyses: string[];
  suggested_improvements: string[];
  overall_quality: "high" | "medium" | "low";
  quality_reasoning: string;
}

interface LlmClient {
  generateJson<T>(params: {
    messages: { role: string; content: string }[];
    model?: string;
  }): Promise<T>;
  models: { extraction: string; report: string };
}

export async function auditReport(
  draftReport: string,
  factPack: FactPack,
  engineResult: FinancialEngineResult,
  llmClient: LlmClient
): Promise<AuditResult> {
  const userMessage = `RELATÓRIO DRAFT para auditoria:

---
${draftReport}
---

FACT PACK que sustenta o relatório:
${JSON.stringify(factPack, null, 2)}

INDICADORES CALCULADOS pelo motor financeiro:
${JSON.stringify(engineResult, null, 2)}

Realize a auditoria completa conforme o checklist.`;

  try {
    const result = await llmClient.generateJson<AuditResult>({
      messages: [
        { role: "system", content: AUDITOR_PROMPT },
        { role: "user", content: userMessage },
      ],
      model: llmClient.models.extraction,
    });

    return {
      issues: result.issues || [],
      strengths: result.strengths || [],
      missing_analyses: result.missing_analyses || [],
      suggested_improvements: result.suggested_improvements || [],
      overall_quality: result.overall_quality || "medium",
      quality_reasoning: result.quality_reasoning || "",
    };
  } catch (error) {
    console.error("Audit failed:", error);
    return {
      issues: [],
      strengths: [],
      missing_analyses: [],
      suggested_improvements: [],
      overall_quality: "low",
      quality_reasoning: `Auditoria falhou: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
