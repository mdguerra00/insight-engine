import React, { useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { FinancialEngineResult } from '@/types/pipeline';

interface EngineResultViewerProps {
  engineResult: FinancialEngineResult;
}

function formatIndicatorValue(value: number, unit: string): string {
  if (unit === '%') return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  if (unit === 'x') return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`;
  if (unit === 'BRL') {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi`;
    if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
    if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mil`;
    return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
  }
  return `${value} ${unit}`;
}

const reconciliationStatusConfig = {
  ok: { icon: CheckCircle, color: 'text-success', label: 'OK' },
  warning: { icon: AlertTriangle, color: 'text-warning', label: 'Atenção' },
  error: { icon: XCircle, color: 'text-destructive', label: 'Inconsistente' },
};

export function EngineResultViewer({ engineResult }: EngineResultViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const errorCount = engineResult.reconciliations.filter(r => r.status === 'error').length;

  return (
    <div className="bg-card rounded-lg border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">Motor Financeiro</h3>
            <p className="text-xs text-muted-foreground">
              {engineResult.calculated_indicators.length} indicador(es) calculado(s),{' '}
              {engineResult.reconciliations.length} reconciliação(ões)
              {errorCount > 0 && <span className="text-destructive"> — {errorCount} inconsistência(s)</span>}
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
          {/* Calculated Indicators */}
          {engineResult.calculated_indicators.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                Indicadores Calculados
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Indicador</th>
                      <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Valor</th>
                      <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Fórmula</th>
                      <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineResult.calculated_indicators.map((ind, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30" title={ind.inputs.join('\n')}>
                        <td className="py-1.5 px-2 text-foreground font-medium">{ind.name}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">
                          {formatIndicatorValue(ind.value, ind.unit)}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground text-xs font-mono">{ind.formula}</td>
                        <td className="py-1.5 px-2 text-muted-foreground text-xs">{ind.period || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reconciliations */}
          {engineResult.reconciliations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                Reconciliações
              </h4>
              <div className="space-y-2">
                {engineResult.reconciliations.map((rec, i) => {
                  const cfg = reconciliationStatusConfig[rec.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={i} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-xs">
                      <StatusIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div>
                        <p className="text-foreground font-medium">{rec.description}</p>
                        <p className="text-muted-foreground">{rec.details}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warnings */}
          {engineResult.warnings.length > 0 && (
            <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-semibold text-warning">Avisos do motor</span>
              </div>
              <ul className="text-xs text-foreground space-y-0.5 ml-5 list-disc">
                {engineResult.warnings.map((w, i) => (
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
