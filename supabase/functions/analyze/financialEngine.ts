// ─────────────────────────────────────────────────────────────────
// Phase 5 — Financial Engine (deterministic calculations)
// Pure code, no LLM. Calculates indicators and runs reconciliations.
// ─────────────────────────────────────────────────────────────────

import type { FactPack, FinancialFact } from "./factPackBuilder.ts";

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
  status: "ok" | "warning" | "error";
  details: string;
}

export interface FinancialEngineResult {
  calculated_indicators: CalculatedIndicator[];
  reconciliations: ReconciliationResult[];
  warnings: string[];
}

// ─── Helper: sum all facts in a category for a given period ───

function sumFacts(facts: FinancialFact[], period?: string | null): number {
  return facts
    .filter((f) => !period || f.period === period)
    .reduce((sum, f) => sum + f.value, 0);
}

function findFact(
  facts: FinancialFact[],
  labelPattern: RegExp,
  period?: string | null
): FinancialFact | undefined {
  return facts.find(
    (f) =>
      labelPattern.test(f.label.toLowerCase()) &&
      (!period || f.period === period)
  );
}

// ─── Main engine ───

export function runFinancialEngine(factPack: FactPack): FinancialEngineResult {
  const indicators: CalculatedIndicator[] = [];
  const reconciliations: ReconciliationResult[] = [];
  const warnings: string[] = [];

  const periods = factPack.periods_found.length > 0
    ? factPack.periods_found
    : [null];

  for (const period of periods) {
    const periodLabel = period || "período não identificado";

    // ─── Revenue totals ───
    const totalRevenue = sumFacts(factPack.facts.revenue, period);
    const totalCogs = sumFacts(factPack.facts.cogs, period);
    const totalExpenses = sumFacts(factPack.facts.expenses, period);
    const totalTaxes = sumFacts(factPack.facts.taxes, period);

    // ─── Gross Margin ───
    if (totalRevenue > 0 && totalCogs > 0) {
      const grossProfit = totalRevenue - totalCogs;
      const grossMargin = (grossProfit / totalRevenue) * 100;
      indicators.push({
        name: "Margem Bruta",
        value: round(grossMargin, 2),
        unit: "%",
        formula: "(Receita - CPV) / Receita × 100",
        inputs: [
          `Receita total: ${fmt(totalRevenue)}`,
          `CPV total: ${fmt(totalCogs)}`,
        ],
        period,
      });

      indicators.push({
        name: "Lucro Bruto",
        value: round(grossProfit, 2),
        unit: "BRL",
        formula: "Receita - CPV",
        inputs: [
          `Receita total: ${fmt(totalRevenue)}`,
          `CPV total: ${fmt(totalCogs)}`,
        ],
        period,
      });
    }

    // ─── Operating Margin ───
    if (totalRevenue > 0 && (totalCogs > 0 || totalExpenses > 0)) {
      const operatingProfit = totalRevenue - totalCogs - totalExpenses;
      const operatingMargin = (operatingProfit / totalRevenue) * 100;
      indicators.push({
        name: "Margem Operacional",
        value: round(operatingMargin, 2),
        unit: "%",
        formula: "(Receita - CPV - Despesas) / Receita × 100",
        inputs: [
          `Receita: ${fmt(totalRevenue)}`,
          `CPV: ${fmt(totalCogs)}`,
          `Despesas: ${fmt(totalExpenses)}`,
        ],
        period,
      });
    }

    // ─── Net Margin ───
    if (totalRevenue > 0 && (totalCogs > 0 || totalExpenses > 0 || totalTaxes > 0)) {
      const netProfit = totalRevenue - totalCogs - totalExpenses - totalTaxes;
      const netMargin = (netProfit / totalRevenue) * 100;
      indicators.push({
        name: "Margem Líquida",
        value: round(netMargin, 2),
        unit: "%",
        formula: "(Receita - CPV - Despesas - Impostos) / Receita × 100",
        inputs: [
          `Receita: ${fmt(totalRevenue)}`,
          `CPV: ${fmt(totalCogs)}`,
          `Despesas: ${fmt(totalExpenses)}`,
          `Impostos: ${fmt(totalTaxes)}`,
        ],
        period,
      });
    }

    // ─── Effective Tax Rate ───
    if (totalRevenue > 0 && totalTaxes > 0) {
      const effectiveTaxRate = (totalTaxes / totalRevenue) * 100;
      indicators.push({
        name: "Carga Tributária Efetiva",
        value: round(effectiveTaxRate, 2),
        unit: "%",
        formula: "Impostos Totais / Receita × 100",
        inputs: [
          `Impostos: ${fmt(totalTaxes)}`,
          `Receita: ${fmt(totalRevenue)}`,
        ],
        period,
      });
    }

    // ─── Expense Ratio ───
    if (totalRevenue > 0 && totalExpenses > 0) {
      const expenseRatio = (totalExpenses / totalRevenue) * 100;
      indicators.push({
        name: "Índice de Despesas / Receita",
        value: round(expenseRatio, 2),
        unit: "%",
        formula: "Despesas Totais / Receita × 100",
        inputs: [
          `Despesas: ${fmt(totalExpenses)}`,
          `Receita: ${fmt(totalRevenue)}`,
        ],
        period,
      });
    }

    // ─── EBITDA approximation from indicators ───
    const ebitdaFact = findFact(factPack.facts.indicators, /ebitda/i, period);
    if (ebitdaFact && totalRevenue > 0) {
      const ebitdaMargin = (ebitdaFact.value / totalRevenue) * 100;
      indicators.push({
        name: "Margem EBITDA",
        value: round(ebitdaMargin, 2),
        unit: "%",
        formula: "EBITDA / Receita × 100",
        inputs: [
          `EBITDA: ${fmt(ebitdaFact.value)}`,
          `Receita: ${fmt(totalRevenue)}`,
        ],
        period,
      });
    }

    // ─── Current Ratio (if balance sheet data exists) ───
    const currentAssets = factPack.facts.assets.filter(
      (f) =>
        /circulante|corrente|current/i.test(f.label) &&
        !/n[ãa]o.circulante|non.current/i.test(f.label) &&
        (!period || f.period === period)
    );
    const currentLiabilities = factPack.facts.liabilities.filter(
      (f) =>
        /circulante|corrente|current/i.test(f.label) &&
        !/n[ãa]o.circulante|non.current/i.test(f.label) &&
        (!period || f.period === period)
    );

    if (currentAssets.length > 0 && currentLiabilities.length > 0) {
      const totalCA = currentAssets.reduce((s, f) => s + f.value, 0);
      const totalCL = currentLiabilities.reduce((s, f) => s + f.value, 0);
      if (totalCL > 0) {
        indicators.push({
          name: "Liquidez Corrente",
          value: round(totalCA / totalCL, 2),
          unit: "x",
          formula: "Ativo Circulante / Passivo Circulante",
          inputs: [
            `Ativo Circulante: ${fmt(totalCA)}`,
            `Passivo Circulante: ${fmt(totalCL)}`,
          ],
          period,
        });
      }
    }

    // ─── Debt-to-Equity ───
    const totalLiabilities = sumFacts(factPack.facts.liabilities, period);
    const totalEquity = sumFacts(factPack.facts.equity, period);
    if (totalLiabilities > 0 && totalEquity > 0) {
      indicators.push({
        name: "Endividamento (Passivo/PL)",
        value: round(totalLiabilities / totalEquity, 2),
        unit: "x",
        formula: "Passivo Total / Patrimônio Líquido",
        inputs: [
          `Passivo Total: ${fmt(totalLiabilities)}`,
          `PL: ${fmt(totalEquity)}`,
        ],
        period,
      });
    }
  }

  // ─── Reconciliations from candidates ───
  for (const candidate of factPack.reconciliation_candidates) {
    const diff = Math.abs(candidate.left_value - candidate.right_value);
    const base = Math.max(
      Math.abs(candidate.left_value),
      Math.abs(candidate.right_value),
      1
    );
    const diffPct = (diff / base) * 100;

    let status: "ok" | "warning" | "error" = "ok";
    if (diffPct > 5) status = "error";
    else if (diffPct > 1) status = "warning";

    let details = `Diferença de ${fmt(diff)} (${round(diffPct, 2)}%)`;
    if (status === "ok") details += " — dentro da tolerância.";
    else if (status === "warning")
      details += " — diferença relevante, verificar.";
    else details += " — inconsistência significativa detectada.";

    reconciliations.push({
      description: candidate.description,
      expected: candidate.left_value,
      actual: candidate.right_value,
      difference: diff,
      difference_pct: round(diffPct, 2),
      status,
      details,
    });
  }

  // ─── Cross-check: Revenue vs Tax (basic sanity) ───
  const allRevenue = sumFacts(factPack.facts.revenue);
  const allTaxes = sumFacts(factPack.facts.taxes);
  if (allRevenue > 0 && allTaxes > 0) {
    const impliedRate = (allTaxes / allRevenue) * 100;
    if (impliedRate > 50) {
      warnings.push(
        `Carga tributária implícita de ${round(impliedRate, 1)}% parece excessivamente alta — verificar se há mistura de fatos de períodos diferentes.`
      );
    }
    if (impliedRate < 1 && allRevenue > 100000) {
      warnings.push(
        `Carga tributária implícita de ${round(impliedRate, 1)}% parece muito baixa para o volume de receita — verificar dados de impostos.`
      );
    }
  }

  // ─── Period-over-period growth ───
  if (factPack.periods_found.length >= 2) {
    const sortedPeriods = [...factPack.periods_found].sort();
    const currentPeriod = sortedPeriods[sortedPeriods.length - 1];
    const previousPeriod = sortedPeriods[sortedPeriods.length - 2];

    const currentRevenue = sumFacts(factPack.facts.revenue, currentPeriod);
    const previousRevenue = sumFacts(factPack.facts.revenue, previousPeriod);

    if (currentRevenue > 0 && previousRevenue > 0) {
      const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      indicators.push({
        name: "Crescimento da Receita",
        value: round(growth, 2),
        unit: "%",
        formula: "(Receita Atual - Receita Anterior) / Receita Anterior × 100",
        inputs: [
          `Receita ${currentPeriod}: ${fmt(currentRevenue)}`,
          `Receita ${previousPeriod}: ${fmt(previousRevenue)}`,
        ],
        period: currentPeriod,
      });
    }
  }

  return { calculated_indicators: indicators, reconciliations, warnings };
}

// ─── Utilities ───

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) {
    return `R$ ${round(n / 1_000_000_000, 2)} bi`;
  }
  if (Math.abs(n) >= 1_000_000) {
    return `R$ ${round(n / 1_000_000, 2)} mi`;
  }
  if (Math.abs(n) >= 1_000) {
    return `R$ ${round(n / 1_000, 2)} mil`;
  }
  return `R$ ${round(n, 2)}`;
}
