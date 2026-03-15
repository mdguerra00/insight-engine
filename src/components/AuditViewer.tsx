import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import type { AuditResult } from '@/types/pipeline';

interface AuditViewerProps {
  auditResult: AuditResult;
}

const SEVERITY_CONFIG = {
  critical: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', label: 'Crítico' },
  major: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', label: 'Relevante' },
  minor: { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: 'Menor' },
};

const QUALITY_CONFIG = {
  high: { color: 'text-success', bg: 'bg-success/10', label: 'Alta Qualidade' },
  medium: { color: 'text-warning', bg: 'bg-warning/10', label: 'Qualidade Média' },
  low: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Baixa Qualidade' },
};

export function AuditViewer({ auditResult }: AuditViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const qualityConfig = QUALITY_CONFIG[auditResult.overall_quality] || QUALITY_CONFIG.medium;
  const criticalCount = auditResult.issues.filter(i => i.severity === 'critical').length;
  const majorCount = auditResult.issues.filter(i => i.severity === 'major').length;

  return (
    <div className="bg-card rounded-lg border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">Auditoria Interna</h3>
            <p className="text-xs text-muted-foreground">
              <span className={`font-medium ${qualityConfig.color}`}>{qualityConfig.label}</span>
              {auditResult.issues.length > 0 && (
                <span>
                  {' — '}{auditResult.issues.length} achado(s)
                  {criticalCount > 0 && `, ${criticalCount} crítico(s)`}
                  {majorCount > 0 && `, ${majorCount} relevante(s)`}
                </span>
              )}
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
          {/* Quality badge */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${qualityConfig.bg} ${qualityConfig.color}`}>
            {auditResult.overall_quality === 'high' ? (
              <CheckCircle className="h-3 w-3" />
            ) : auditResult.overall_quality === 'low' ? (
              <XCircle className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {qualityConfig.label}
          </div>
          {auditResult.quality_reasoning && (
            <p className="text-xs text-muted-foreground">{auditResult.quality_reasoning}</p>
          )}

          {/* Issues */}
          {auditResult.issues.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                Problemas Identificados
              </h4>
              <div className="space-y-2">
                {auditResult.issues.map((issue, i) => {
                  const cfg = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.minor;
                  const SeverityIcon = cfg.icon;
                  return (
                    <div key={i} className={`p-2.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-2">
                        <SeverityIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-xs text-muted-foreground">{issue.category}</span>
                          </div>
                          <p className="text-xs text-foreground">{issue.description}</p>
                          {issue.suggestion && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Sugestão: {issue.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strengths */}
          {auditResult.strengths.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                Pontos Fortes
              </h4>
              <ul className="text-xs text-foreground space-y-1 ml-4 list-disc">
                {auditResult.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing analyses */}
          {auditResult.missing_analyses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                Análises Ausentes
              </h4>
              <ul className="text-xs text-foreground space-y-1 ml-4 list-disc">
                {auditResult.missing_analyses.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {auditResult.suggested_improvements.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
                Melhorias Sugeridas
              </h4>
              <ul className="text-xs text-foreground space-y-1 ml-4 list-disc">
                {auditResult.suggested_improvements.map((imp, i) => (
                  <li key={i}>{imp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
