import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { FileUpload } from '@/components/FileUpload';
import { DocumentCard } from '@/components/DocumentCard';
import { ReportViewer } from '@/components/ReportViewer';
import { PipelineProgress } from '@/components/PipelineProgress';
import { FactPackViewer } from '@/components/FactPackViewer';
import { EngineResultViewer } from '@/components/EngineResultViewer';
import { AuditViewer } from '@/components/AuditViewer';
import { Button } from '@/components/ui/button';
import { extractPdf } from '@/lib/extractors/extractPdf';
import { extractXlsx } from '@/lib/extractors/extractXlsx';
import { extractCsv } from '@/lib/extractors/extractCsv';
import { buildAnalysisPayload } from '@/lib/buildAnalysisPayload';
import { createTraceId, logDiagnosticEvent } from '@/lib/structuredLogger';
import type { DocumentWithExtraction, ExtractionStatus } from '@/types/documents';
import type {
  PipelineState,
  DocumentClassification,
  FactPack,
  FinancialEngineResult,
  AuditResult,
} from '@/types/pipeline';
import { createInitialPipelineState } from '@/types/pipeline';
import { Loader2, AlertCircle, Play } from 'lucide-react';
import { toast } from 'sonner';

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.\-]/g, '');
}

function getFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  return ext;
}

function toErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

const Index = () => {
  const [documents, setDocuments] = useState<DocumentWithExtraction[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportCreatedAt, setReportCreatedAt] = useState<string>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);

  // ─── File upload & extraction (unchanged) ───

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const traceId = createTraceId();

    for (const file of files) {
      const fileType = getFileType(file);
      const docId = crypto.randomUUID();
      const safeName = sanitizeFileName(file.name);
      const storagePath = `uploads/${docId}/${safeName}`;

      logDiagnosticEvent({
        trace_id: traceId,
        stage: 'upload',
        status: 'start',
        action: 'file_received',
        document_id: docId,
        file_name: file.name,
        details: {
          file_type: fileType,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: storagePath,
        },
      });

      const newDoc: DocumentWithExtraction = {
        id: docId,
        file_name: file.name,
        file_type: fileType,
        mime_type: file.type,
        storage_path: storagePath,
        upload_status: 'uploading',
        created_at: new Date().toISOString(),
      };
      setDocuments(prev => [...prev, newDoc]);

      try {
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        await supabase.from('documents').insert({
          id: docId,
          file_name: file.name,
          file_type: fileType,
          mime_type: file.type,
          storage_path: storagePath,
          upload_status: 'uploaded',
        });

        setDocuments(prev => prev.map(d =>
          d.id === docId
            ? {
                ...d,
                upload_status: 'uploaded' as const,
                extraction: {
                  id: '',
                  document_id: docId,
                  extraction_status: 'extracting' as ExtractionStatus,
                  detected_type: fileType,
                  preview_text: '',
                  extracted_text: null,
                  extracted_json: null,
                  created_at: new Date().toISOString(),
                },
              }
            : d
        ));

        logDiagnosticEvent({
          trace_id: traceId,
          stage: 'upload',
          status: 'success',
          action: 'storage_and_document_saved',
          document_id: docId,
          file_name: file.name,
        });

        logDiagnosticEvent({
          trace_id: traceId,
          stage: 'extraction',
          status: 'start',
          action: 'client_extraction_started',
          document_id: docId,
          file_name: file.name,
          details: { extractor: fileType },
        });

        let extractionStatus: ExtractionStatus = 'failed';
        let previewText = '';
        let extractedText: string | null = null;
        let extractedJson: Record<string, unknown> | null = null;
        const detectedType = fileType;

        if (fileType === 'pdf') {
          const result = await extractPdf(file);
          extractionStatus = result.status;
          previewText = result.preview;
          extractedText = result.text;
          extractedJson = { pageCount: result.pageCount };
        } else if (fileType === 'xlsx') {
          const result = await extractXlsx(file);
          extractionStatus = result.status;
          previewText = result.preview;
          extractedJson = { sheets: result.sheets, sheetCount: result.sheetCount };
        } else if (fileType === 'csv') {
          const result = await extractCsv(file);
          extractionStatus = result.status;
          previewText = result.preview;
          extractedText = result.rowsSample.map(r => r.join(',')).join('\n');
          extractedJson = {
            columns: result.columns,
            rowCount: result.rowCount,
            delimiter: result.delimiter,
            rowsSample: result.rowsSample,
          };
        }

        const extractionId = crypto.randomUUID();
        await supabase.from('document_extractions').insert({
          id: extractionId,
          document_id: docId,
          extraction_status: extractionStatus,
          detected_type: detectedType,
          preview_text: previewText,
          extracted_text: extractedText,
          extracted_json: extractedJson as Json,
        });

        logDiagnosticEvent({
          trace_id: traceId,
          stage: 'extraction',
          status: extractionStatus === 'failed' ? 'error' : 'success',
          action: 'extraction_completed',
          document_id: docId,
          file_name: file.name,
          details: {
            extraction_id: extractionId,
            extraction_status: extractionStatus,
            preview_size: previewText.length,
          },
        });

        setDocuments(prev => prev.map(d =>
          d.id === docId
            ? {
                ...d,
                upload_status: 'uploaded' as const,
                extraction: {
                  id: extractionId,
                  document_id: docId,
                  extraction_status: extractionStatus,
                  detected_type: detectedType,
                  preview_text: previewText,
                  extracted_text: extractedText,
                  extracted_json: extractedJson,
                  created_at: new Date().toISOString(),
                },
              }
            : d
        ));

        if (extractionStatus === 'failed') {
          toast.error(`Falha ao extrair: ${file.name}`);
        } else if (extractionStatus === 'low_content') {
          toast.warning(`Conteúdo insuficiente: ${file.name}`);
        } else {
          toast.success(`Extraído: ${file.name}`);
        }
      } catch (err) {
        console.error('Upload/extraction error:', err);
        logDiagnosticEvent({
          trace_id: traceId,
          stage: 'upload',
          status: 'error',
          action: 'upload_or_extraction_failed',
          document_id: docId,
          file_name: file.name,
          details: toErrorDetails(err),
        });
        setDocuments(prev => prev.map(d =>
          d.id === docId ? { ...d, upload_status: 'error' as const } : d
        ));
        toast.error(`Erro ao processar: ${file.name}`);
      }
    }
  }, []);

  const handleRemoveDoc = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  const extractedDocs = documents.filter(d => d.extraction?.extraction_status === 'extracted');
  const allFailed = documents.length > 0 && extractedDocs.length === 0;
  const hasExtracting = documents.some(
    d => d.extraction?.extraction_status === 'extracting' || d.upload_status === 'uploading'
  );
  const canAnalyze = extractedDocs.length > 0 && !hasExtracting && !isAnalyzing;

  // ─── Pipeline analysis handler ───

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) return;

    const traceId = createTraceId();

    logDiagnosticEvent({
      trace_id: traceId,
      stage: 'payload',
      status: 'start',
      action: 'analysis_requested',
      details: {
        total_documents: documents.length,
        extracted_documents: extractedDocs.length,
      },
    });

    setIsAnalyzing(true);
    setReportText('');
    setIsStreaming(true);

    // Initialize pipeline state
    const initialState = createInitialPipelineState();
    setPipelineState(initialState);

    try {
      const payload = buildAnalysisPayload(documents);

      logDiagnosticEvent({
        trace_id: traceId,
        stage: 'payload',
        status: 'success',
        action: 'payload_built',
        details: {
          payload_document_count: payload.documents.length,
          payload_source_types: payload.documents.map(doc => doc.source_type),
        },
      });

      logDiagnosticEvent({
        trace_id: traceId,
        stage: 'edge_function',
        status: 'start',
        action: 'invoke_analyze_function',
      });

      const supabaseApiKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!import.meta.env.VITE_SUPABASE_URL || !supabaseApiKey) {
        throw new Error('Configuração Supabase ausente no frontend.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseApiKey}`,
          },
          body: JSON.stringify({ payload, trace_id: traceId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logDiagnosticEvent({
          trace_id: traceId,
          stage: 'edge_function',
          status: 'error',
          action: 'analyze_function_http_error',
          details: { status_code: response.status, error: errorData },
        });
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
      }

      logDiagnosticEvent({
        trace_id: traceId,
        stage: 'edge_function',
        status: 'success',
        action: 'analyze_function_stream_open',
      });

      if (!response.body) throw new Error('Sem corpo na resposta');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullReport = '';
      let streamDone = false;
      let currentEventType = '';

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);

          // Empty line = end of event
          if (line.trim() === '') {
            currentEventType = '';
            continue;
          }

          // SSE comment
          if (line.startsWith(':')) continue;

          // Event type line
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }

          // Data line
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);

            if (currentEventType === 'pipeline') {
              // Pipeline progress event
              handlePipelineEvent(parsed);
            } else if (currentEventType === 'pipeline_complete') {
              // Pipeline complete with timings
              setPipelineState(prev => prev ? { ...prev, timings: parsed.timings } : prev);
            } else if (currentEventType === 'pipeline_error') {
              // Pipeline error
              toast.error(`Erro no pipeline: ${parsed.error}`);
            } else {
              // Regular SSE data — OpenAI streaming chunks
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullReport += content;
                setReportText(fullReport);
              }
            }
          } catch {
            // Incomplete JSON — put back and wait for more data
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullReport += content;
              setReportText(fullReport);
            }
          } catch { /* ignore */ }
        }
      }

      setIsStreaming(false);
      const now = new Date().toISOString();
      setReportCreatedAt(now);

      // Mark final step as completed
      setPipelineState(prev => {
        if (!prev) return prev;
        const steps = prev.steps.map(s =>
          s.id === 'final_report' ? { ...s, status: 'completed' as const } : s
        );
        return { ...prev, steps };
      });

      logDiagnosticEvent({
        trace_id: traceId,
        stage: 'report',
        status: 'success',
        action: 'report_stream_completed',
        details: { report_size_chars: fullReport.length },
      });

      // Save report to DB (with fact pack and audit in report_json)
      const reportId = crypto.randomUUID();
      logDiagnosticEvent({
        trace_id: traceId,
        stage: 'save',
        status: 'start',
        action: 'persist_report_started',
        details: { report_id: reportId },
      });

      try {
        await supabase.from('analysis_reports').insert({
          id: reportId,
          report_text: fullReport,
          report_json: pipelineState ? {
            classifications: pipelineState.classifications,
            fact_pack: pipelineState.factPack,
            engine_result: pipelineState.engineResult,
            audit_result: pipelineState.auditResult,
            timings: pipelineState.timings,
          } as unknown as Json : null,
          created_at: now,
        });

        for (const doc of extractedDocs) {
          await supabase.from('report_documents').insert({
            report_id: reportId,
            document_id: doc.id,
          });
        }

        logDiagnosticEvent({
          trace_id: traceId,
          stage: 'save',
          status: 'success',
          action: 'report_saved_with_relations',
          details: { report_document_count: extractedDocs.length },
        });
      } catch (saveError) {
        logDiagnosticEvent({
          trace_id: traceId,
          stage: 'save',
          status: 'error',
          action: 'persist_report_failed',
          details: toErrorDetails(saveError),
        });
        throw saveError;
      }

      toast.success('Relatório gerado com sucesso');
    } catch (err) {
      console.error('Analysis error:', err);
      logDiagnosticEvent({
        trace_id: traceId,
        stage: 'report',
        status: 'error',
        action: 'analysis_failed',
        details: toErrorDetails(err),
      });
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar relatório');
      setIsStreaming(false);
    } finally {
      setIsAnalyzing(false);
    }
  }, [canAnalyze, documents, extractedDocs, pipelineState]);

  // ─── Handle pipeline SSE events ───

  const handlePipelineEvent = useCallback((event: {
    step: string;
    step_index: number;
    total_steps: number;
    label: string;
    status: 'running' | 'completed' | 'error';
    result?: unknown;
    error?: string;
  }) => {
    setPipelineState(prev => {
      if (!prev) return prev;

      const steps = prev.steps.map((s, i) => {
        if (i === event.step_index) {
          return { ...s, status: event.status, error: event.error };
        }
        return s;
      });

      const newState = { ...prev, steps };

      // Store results from completed steps
      if (event.status === 'completed' && event.result) {
        switch (event.step) {
          case 'classify':
            newState.classifications = event.result as DocumentClassification[];
            break;
          case 'facts':
            newState.factPack = event.result as FactPack;
            break;
          case 'engine':
            newState.engineResult = event.result as FinancialEngineResult;
            break;
          case 'audit':
            newState.auditResult = event.result as AuditResult;
            break;
        }
      }

      return newState;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <h1 className="text-lg font-bold text-header-foreground tracking-tight">
            Financial Intelligence Engine
          </h1>
          <p className="text-sm text-header-foreground/70 mt-0.5">
            Envie documentos empresariais e receba um relatório executivo inteligente.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Upload */}
        <section>
          <FileUpload onFilesSelected={handleFilesSelected} disabled={isAnalyzing} />
        </section>

        {/* Document list */}
        {documents.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Documentos ({documents.length})
              {extractedDocs.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  {' '}— {extractedDocs.length} com conteúdo extraído
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {documents.map(doc => (
                <DocumentCard key={doc.id} doc={doc} onRemove={handleRemoveDoc} />
              ))}
            </div>
          </section>
        )}

        {/* Analysis blocked message */}
        {allFailed && documents.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              Nenhum documento teve conteúdo extraído com sucesso. A análise está bloqueada.
            </p>
          </div>
        )}

        {/* Analyze button */}
        {documents.length > 0 && (
          <div className="flex justify-center">
            <Button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              size="lg"
              className="gap-2 px-8"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pipeline Progress */}
        {pipelineState && (
          <section>
            <PipelineProgress steps={pipelineState.steps} />
          </section>
        )}

        {/* Phase 9: Verification & Trust UI */}

        {/* Fact Pack Viewer */}
        {pipelineState?.factPack && (
          <section>
            <FactPackViewer
              factPack={pipelineState.factPack}
              classifications={pipelineState.classifications}
            />
          </section>
        )}

        {/* Engine Result Viewer */}
        {pipelineState?.engineResult && (
          <section>
            <EngineResultViewer engineResult={pipelineState.engineResult} />
          </section>
        )}

        {/* Audit Viewer */}
        {pipelineState?.auditResult && (
          <section>
            <AuditViewer auditResult={pipelineState.auditResult} />
          </section>
        )}

        {/* Report */}
        {reportText && (
          <section>
            <ReportViewer
              reportText={reportText}
              createdAt={reportCreatedAt}
              isStreaming={isStreaming}
            />
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
