import React, { useState } from 'react';
import { Database, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react';
import type { FactPack, FinancialFact, DocumentClassification } from '@/types/pipeline';
import { Button } from '@/components/ui/button';

interface FactPackViewerProps {
  factPack: FactPack;
  classifications: DocumentClassification[] | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  revenue: 'Receitas',
  cogs: 'Custos (CPV/CMV)',
  expenses: 'Despesas',
  taxes: 'Impostos e Contribuições',
  assets: 'Ativos',
  liabilities: 'Passivos',
  equity: 'Patrimônio Líquido',
  cash: 'Caixa e Fluxo',
  headcount: 'Pessoal',
  indicators: 'Indicadores',
  other: 'Outros',
};

const CLASS_LABELS: Record<string, string> = {
  dre: 'DRE',
  balanco_patrimonial: 'Balanço Patrimonial',
  balancete: 'Balancete',
  livro_razao: 'Livro Razão',
  apuracao_fiscal: 'Apuração Fiscal',
  fluxo_caixa: 'Fluxo de Caixa',
  planilha_operacional: 'Planilha Operacional',
  relatorio_gerencial: 'Relatório Gerencial',
  nota_fiscal: 'Nota Fiscal',
  contrato: 'Contrato',
  desconhecido: 'Desconhecido',
};

function formatValue(value: number, unit: string): string {
  const abs = Math.abs(value);
  let formatted: string;

  if (abs >= 1_000_000_000) {
    formatted = `${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi`;
  } else if (abs >= 1_000_000) {
    formatted = `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  } else if (abs >= 1_000) {
    formatted = `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mil`;
  } else {
    formatted = value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  if (unit === 'BRL') return `R$ ${formatted}`;
  if (unit === 'USD') return `US$ ${formatted}`;
  if (unit === '%') return `${formatted}%`;
  return `${formatted} ${unit}`;
}

function FactTable({ facts, category }: { facts: FinancialFact[]; category: string }) {
  if (facts.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
        {CATEGORY_LABELS[category] || category}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Fato</th>
              <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Valor</th>
              <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Período</th>
              <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Fonte</th>
            </tr>
          </thead>
          <tbody>
            {facts.map((fact, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-1.5 px-2 text-foreground">{fact.label}</td>
                <td className="py-1.5 px-2 text-right tabular-nums font-medium text-foreground">
                  {formatValue(fact.value, fact.unit)}
                </td>
                <td className="py-1.5 px-2 text-muted-foreground text-xs">{fact.period || '—'}</td>
                <td className="py-1.5 px-2 text-muted-foreground text-xs truncate max-w-[200px]" title={fact.source}>
                  {fact.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FactPackViewer({ factPack, classifications }: FactPackViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const totalFacts = Object.values(factPack.facts).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div className="bg-card rounded-lg border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">Fact Pack</h3>
            <p className="text-xs text-muted-foreground">
              {totalFacts} fatos extraídos de {factPack.document_inventory.length} documento(s)
              {factPack.warnings.length > 0 && ` — ${factPack.warnings.length} aviso(s)`}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
          {/* Document Inventory */}
          {classifications && classifications.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                Documentos Classificados
              </h4>
              <div className="space-y-1.5">
                {classifications.map((cls, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-foreground truncate">{cls.document_name}</span>
                      <span className="shrink-0 px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary font-medium">
                        {CLASS_LABELS[cls.document_class] || cls.document_class}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                      {cls.period_detected && <span>{cls.period_detected}</span>}
                      <span>{Math.round(cls.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fact tables by category */}
          {Object.entries(factPack.facts).map(([category, facts]) => (
            <FactTable key={category} facts={facts} category={category} />
          ))}

          {/* Gaps */}
          {factPack.gaps.length > 0 && (
            <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-semibold text-warning">Lacunas identificadas</span>
              </div>
              <ul className="text-xs text-foreground space-y-0.5 ml-5 list-disc">
                {factPack.gaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {factPack.warnings.length > 0 && (
            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">Avisos</span>
              </div>
              <ul className="text-xs text-foreground space-y-0.5 ml-5 list-disc">
                {factPack.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
