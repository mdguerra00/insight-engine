import React from 'react';
import { CheckCircle, Loader2, Circle, XCircle } from 'lucide-react';
import type { PipelineStepInfo } from '@/types/pipeline';

interface PipelineProgressProps {
  steps: PipelineStepInfo[];
}

const statusIcons: Record<string, React.ElementType> = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle,
  error: XCircle,
};

const statusColors: Record<string, string> = {
  pending: 'text-muted-foreground',
  running: 'text-primary',
  completed: 'text-success',
  error: 'text-destructive',
};

export function PipelineProgress({ steps }: PipelineProgressProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Pipeline de Análise</h3>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const Icon = statusIcons[step.status];
          const color = statusColors[step.status];
          const isRunning = step.status === 'running';

          return (
            <div key={step.id} className="flex items-center gap-3">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <Icon
                  className={`h-4 w-4 ${color} ${isRunning ? 'animate-spin' : ''}`}
                />
                {i < steps.length - 1 && (
                  <div
                    className={`w-px h-4 mt-0.5 ${
                      step.status === 'completed' ? 'bg-success' : 'bg-border'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-sm ${
                  step.status === 'running'
                    ? 'text-foreground font-medium'
                    : step.status === 'completed'
                      ? 'text-muted-foreground'
                      : step.status === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground/60'
                }`}
              >
                {step.label}
                {step.status === 'running' && '...'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
