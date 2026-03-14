import React from 'react';
import { FileText, CheckCircle, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { DocumentWithExtraction, ExtractionStatus } from '@/types/documents';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface DocumentCardProps {
  doc: DocumentWithExtraction;
  onRemove: (id: string) => void;
}

const statusConfig: Record<ExtractionStatus | 'pending', { icon: React.ElementType; label: string; className: string; borderClass: string }> = {
  pending: { icon: Loader2, label: 'Aguardando', className: 'text-muted-foreground', borderClass: 'border-border' },
  extracting: { icon: Loader2, label: 'Extraindo...', className: 'text-primary animate-spin', borderClass: 'border-primary' },
  extracted: { icon: CheckCircle, label: 'Extraído', className: 'text-success', borderClass: 'border-success' },
  low_content: { icon: AlertTriangle, label: 'Conteúdo insuficiente', className: 'text-warning', borderClass: 'border-warning' },
  failed: { icon: XCircle, label: 'Falhou', className: 'text-destructive', borderClass: 'border-destructive' },
};

export function DocumentCard({ doc, onRemove }: DocumentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = doc.extraction?.extraction_status || 'pending';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={`border-l-4 ${config.borderClass} bg-card rounded-lg p-4 transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
            <p className="text-xs text-muted-foreground uppercase">{doc.file_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 ${config.className}`} />
            <span className={`text-xs font-medium ${config.className}`}>{config.label}</span>
          </div>
          {doc.extraction?.preview_text && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemove(doc.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && doc.extraction?.preview_text && (
        <div className="mt-3 p-3 bg-muted rounded-md">
          <p className="text-xs font-medium text-muted-foreground mb-1">Conteúdo extraído (preview):</p>
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
            {doc.extraction.preview_text}
          </pre>
        </div>
      )}

      {status === 'failed' && doc.extraction && (
        <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
          Não foi possível extrair o conteúdo deste arquivo.
        </div>
      )}
    </div>
  );
}
