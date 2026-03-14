import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileUpload } from '@/components/FileUpload';
import { DocumentCard } from '@/components/DocumentCard';
import { ReportViewer } from '@/components/ReportViewer';
import { Button } from '@/components/ui/button';
import { extractPdf } from '@/lib/extractors/extractPdf';
import { extractXlsx } from '@/lib/extractors/extractXlsx';
import { extractCsv } from '@/lib/extractors/extractCsv';
import { buildAnalysisPayload } from '@/lib/buildAnalysisPayload';
import type { DocumentWithExtraction, ExtractionStatus } from '@/types/documents';
import { Loader2, AlertCircle, Play } from 'lucide-react';
import { toast } from 'sonner';

function getFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  return ext;
}

const Index = () => {
  const [documents, setDocuments] = useState<DocumentWithExtraction[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportCreatedAt, setReportCreatedAt] = useState<string>();
  const [isStreaming, setIsStreaming] = useState(false);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    for (const file of files) {
      const fileType = getFileType(file);
      const docId = crypto.randomUUID();
      const storagePath = `uploads/${docId}/${file.name}`;

      // Add document to state
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
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        // Save to DB
        await supabase.from('documents').insert({
          id: docId,
          file_name: file.name,
          file_type: fileType,
          mime_type: file.type,
          storage_path: storagePath,
          upload_status: 'uploaded',
        });

        // Update status
        setDocuments(prev => prev.map(d =>
          d.id === docId ? { ...d, upload_status: 'uploaded' as const, extraction: { id: '', document_id: docId, extraction_status: 'extracting' as ExtractionStatus, detected_type: fileType, preview_text: '', extracted_text: null, extracted_json: null, created_at: new Date().toISOString() } } : d
        ));

        // Extract content client-side
        let extractionStatus: ExtractionStatus = 'failed';
        let previewText = '';
        let extractedText: string | null = null;
        let extractedJson: Record<string, unknown> | null = null;
        let detectedType = fileType;

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
          extractedJson = { columns: result.columns, rowCount: result.rowCount, delimiter: result.delimiter, rowsSample: result.rowsSample };
        }

        // Save extraction to DB
        const extractionId = crypto.randomUUID();
        await supabase.from('document_extractions').insert({
          id: extractionId,
          document_id: docId,
          extraction_status: extractionStatus,
          detected_type: detectedType,
          preview_text: previewText,
          extracted_text: extractedText,
          extracted_json: extractedJson,
        });

        // Update state
        setDocuments(prev => prev.map(d =>
          d.id === docId ? {
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
          } : d
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
  const hasExtracting = documents.some(d => d.extraction?.extraction_status === 'extracting' || d.upload_status === 'uploading');
  const canAnalyze = extractedDocs.length > 0 && !hasExtracting && !isAnalyzing;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) return;

    setIsAnalyzing(true);
    setReportText('');
    setIsStreaming(true);

    try {
      const payload = buildAnalysisPayload(documents);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ payload }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
      }

      if (!response.body) throw new Error('Sem corpo na resposta');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullReport = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullReport += content;
              setReportText(fullReport);
            }
          } catch {
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

      // Save report to DB
      const reportId = crypto.randomUUID();
      await supabase.from('analysis_reports').insert({
        id: reportId,
        report_text: fullReport,
        report_json: null,
        created_at: now,
      });

      // Save report-document relations
      for (const doc of extractedDocs) {
        await supabase.from('report_documents').insert({
          report_id: reportId,
          document_id: doc.id,
        });
      }

      toast.success('Relatório gerado com sucesso');
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar relatório');
      setIsStreaming(false);
    } finally {
      setIsAnalyzing(false);
    }
  }, [canAnalyze, documents, extractedDocs]);

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
                <span className="text-muted-foreground font-normal"> — {extractedDocs.length} com conteúdo extraído</span>
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
