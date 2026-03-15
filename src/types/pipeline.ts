// ─────────────────────────────────────────────────────────────────
// Pipeline types shared between frontend components
// ─────────────────────────────────────────────────────────────────

// ─── Document Classification (Phase 3) ───

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

// ─── Fact Pack (Phase 4) ───

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

// ─── Financial Engine (Phase 5) ───

export interface CalculatedIndicator {
  name: string;
  value: number;
  unit: string;
  formula: string;
  inputs: string[];
  period: string | null;
}

export interface ReconciliationResult {
  description: string;
  expected: number;
  actual: number;
  difference: number;
  difference_pct: number;
  status: 'ok' | 'warning' | 'error';
  details: string;
}

export interface FinancialEngineResult {
  calculated_indicators: CalculatedIndicator[];
  reconciliations: ReconciliationResult[];
  warnings: string[];
}

// ─── Audit (Phase 7) ───

export interface AuditIssue {
  severity: 'critical' | 'major' | 'minor';
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
  overall_quality: 'high' | 'medium' | 'low';
  quality_reasoning: string;
}

// ─── Pipeline Progress ───

export type PipelineStepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface PipelineStepInfo {
  id: string;
  label: string;
  status: PipelineStepStatus;
  result?: unknown;
  error?: string;
}

export const PIPELINE_STEPS_DEF: Array<{ id: string; label: string }> = [
  { id: 'classify', label: 'Classificando documentos' },
  { id: 'facts', label: 'Extraindo fatos financeiros' },
  { id: 'engine', label: 'Calculando indicadores' },
  { id: 'draft', label: 'Gerando relatório draft' },
  { id: 'audit', label: 'Auditando relatório' },
  { id: 'final_report', label: 'Gerando relatório final' },
];

export interface PipelineState {
  steps: PipelineStepInfo[];
  classifications: DocumentClassification[] | null;
  factPack: FactPack | null;
  engineResult: FinancialEngineResult | null;
  auditResult: AuditResult | null;
  timings: Record<string, number> | null;
}

export function createInitialPipelineState(): PipelineState {
  return {
    steps: PIPELINE_STEPS_DEF.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending' as const,
    })),
    classifications: null,
    factPack: null,
    engineResult: null,
    auditResult: null,
    timings: null,
  };
}
