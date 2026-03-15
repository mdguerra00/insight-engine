import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Clock } from 'lucide-react';

interface ReportViewerProps {
  reportText: string;
  createdAt?: string;
  isStreaming?: boolean;
}

export function ReportViewer({ reportText, createdAt, isStreaming }: ReportViewerProps) {
  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Relatório Executivo</h2>
        </div>
        {createdAt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {new Date(createdAt).toLocaleString('pt-BR')}
          </div>
        )}
      </div>
      <div className="p-6 report-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportText}</ReactMarkdown>
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
