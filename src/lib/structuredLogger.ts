export type DiagnosticStage =
  | 'upload'
  | 'extraction'
  | 'payload'
  | 'edge_function'
  | 'report'
  | 'save'
  | 'prompt'
  | 'model_call';

export type DiagnosticStatus = 'start' | 'success' | 'error' | 'info';

export interface DiagnosticLog {
  trace_id: string;
  stage: DiagnosticStage;
  status: DiagnosticStatus;
  action: string;
  document_id?: string;
  file_name?: string;
  details?: Record<string, unknown>;
}

export function logDiagnosticEvent(event: DiagnosticLog): void {
  const payload = {
    ts: new Date().toISOString(),
    ...event,
  };

  if (event.status === 'error') {
    console.error('[diagnostic]', payload);
    return;
  }

  console.log('[diagnostic]', payload);
}

export function createTraceId(): string {
  return crypto.randomUUID();
}
