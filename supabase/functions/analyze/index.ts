// ─────────────────────────────────────────────────────────────────
// Multi-layer Analysis Pipeline
// Layer 1: Extraction (client-side, already done)
// Layer 2: Classification (LLM)
// Layer 3: Fact Pack Builder (LLM)
// Layer 4: Financial Engine (deterministic code)
// Layer 5: Draft Report (LLM)
// Layer 6: Audit (LLM)
// Layer 7: Final Report (LLM, streaming)
// ─────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLlmClient } from "./llmClient.ts";
import { classifyDocuments } from "./classifier.ts";
import { buildFactPack } from "./factPackBuilder.ts";
import { runFinancialEngine } from "./financialEngine.ts";
import { auditReport } from "./auditor.ts";
import { DRAFT_REPORT_PROMPT, FINAL_REPORT_PROMPT } from "./prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Diagnostic logging ───

type DiagnosticStatus = "start" | "success" | "error" | "info";

function logDiagnosticEvent(params: {
  traceId: string;
  stage: string;
  status: DiagnosticStatus;
  action: string;
  details?: Record<string, unknown>;
}) {
  const payload = {
    ts: new Date().toISOString(),
    trace_id: params.traceId,
    stage: params.stage,
    status: params.status,
    action: params.action,
    details: params.details,
  };
  if (params.status === "error") {
    console.error("[diagnostic]", payload);
  } else {
    console.log("[diagnostic]", payload);
  }
}

// ─── Pipeline step definitions ───

const PIPELINE_STEPS = [
  { id: "classify", label: "Classificando documentos" },
  { id: "facts", label: "Extraindo fatos financeiros" },
  { id: "engine", label: "Calculando indicadores" },
  { id: "draft", label: "Gerando relatório draft" },
  { id: "audit", label: "Auditando relatório" },
  { id: "final_report", label: "Gerando relatório final" },
] as const;

// ─── SSE helpers ───

function sseEvent(event: string, data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseData(data: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${data}\n\n`);
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body: { payload?: { documents?: unknown[] }; trace_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido no corpo da requisição." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { payload, trace_id: traceIdFromRequest } = body;
    const traceId =
      typeof traceIdFromRequest === "string" && traceIdFromRequest
        ? traceIdFromRequest
        : crypto.randomUUID();

    logDiagnosticEvent({
      traceId,
      stage: "edge_function",
      status: "start",
      action: "request_received",
    });

    if (
      !payload ||
      !Array.isArray(payload.documents) ||
      payload.documents.length === 0
    ) {
      logDiagnosticEvent({
        traceId,
        stage: "edge_function",
        status: "error",
        action: "invalid_payload",
      });
      return new Response(
        JSON.stringify({
          error: "Nenhum documento com conteúdo extraído fornecido.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let llmClient;
    try {
      llmClient = createLlmClient();
    } catch (error) {
      logDiagnosticEvent({
        traceId,
        stage: "edge_function",
        status: "error",
        action: "missing_api_key",
      });
      throw error;
    }

    const documents = payload.documents as Array<{
      document_name: string;
      source_type: string;
      content: Record<string, unknown>;
    }>;

    // ─── Create SSE stream for pipeline progress + final report ───
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Run pipeline in background, writing to stream
    (async () => {
      try {
        const timings: Record<string, number> = {};

        // Helper: send pipeline progress event
        const sendProgress = async (
          stepIndex: number,
          status: "running" | "completed" | "error",
          result?: unknown,
          error?: string
        ) => {
          const step = PIPELINE_STEPS[stepIndex];
          await writer.write(
            sseEvent("pipeline", {
              step: step.id,
              step_index: stepIndex,
              total_steps: PIPELINE_STEPS.length,
              label: step.label,
              status,
              result: status === "completed" ? result : undefined,
              error: status === "error" ? error : undefined,
            })
          );
        };

        // ═══════════════════════════════════════════════════════
        // STEP 1: Classify documents
        // ═══════════════════════════════════════════════════════
        let t0 = Date.now();
        await sendProgress(0, "running");

        logDiagnosticEvent({
          traceId,
          stage: "classify",
          status: "start",
          action: "classifying_documents",
          details: { document_count: documents.length },
        });

        const classifications = await classifyDocuments(documents, llmClient);
        timings.classify = Date.now() - t0;

        logDiagnosticEvent({
          traceId,
          stage: "classify",
          status: "success",
          action: "classification_completed",
          details: {
            classifications: classifications.map((c) => ({
              name: c.document_name,
              class: c.document_class,
              confidence: c.confidence,
            })),
            duration_ms: timings.classify,
          },
        });

        await sendProgress(0, "completed", classifications);

        // ═══════════════════════════════════════════════════════
        // STEP 2: Build Fact Pack
        // ═══════════════════════════════════════════════════════
        t0 = Date.now();
        await sendProgress(1, "running");

        logDiagnosticEvent({
          traceId,
          stage: "facts",
          status: "start",
          action: "extracting_facts",
        });

        const factPack = await buildFactPack(
          documents,
          classifications,
          llmClient
        );
        timings.facts = Date.now() - t0;

        const factCount = Object.values(factPack.facts).reduce(
          (sum, arr) => sum + arr.length,
          0
        );

        logDiagnosticEvent({
          traceId,
          stage: "facts",
          status: "success",
          action: "facts_extracted",
          details: {
            fact_count: factCount,
            gaps: factPack.gaps.length,
            warnings: factPack.warnings.length,
            duration_ms: timings.facts,
          },
        });

        await sendProgress(1, "completed", factPack);

        // ═══════════════════════════════════════════════════════
        // STEP 3: Financial Engine (deterministic)
        // ═══════════════════════════════════════════════════════
        t0 = Date.now();
        await sendProgress(2, "running");

        const engineResult = runFinancialEngine(factPack);
        timings.engine = Date.now() - t0;

        logDiagnosticEvent({
          traceId,
          stage: "engine",
          status: "success",
          action: "engine_completed",
          details: {
            indicators_calculated: engineResult.calculated_indicators.length,
            reconciliations: engineResult.reconciliations.length,
            duration_ms: timings.engine,
          },
        });

        await sendProgress(2, "completed", engineResult);

        // ═══════════════════════════════════════════════════════
        // STEP 4: Draft Report (non-streaming)
        // ═══════════════════════════════════════════════════════
        t0 = Date.now();
        await sendProgress(3, "running");

        logDiagnosticEvent({
          traceId,
          stage: "draft",
          status: "start",
          action: "generating_draft",
        });

        const enrichedPayload = {
          fact_pack: factPack,
          financial_engine: engineResult,
          classifications,
        };

        const draftUserMessage = `Com base no FACT PACK enriquecido abaixo, gere o relatório executivo DRAFT.

${JSON.stringify(enrichedPayload, null, 2)}`;

        const draftResponse = await llmClient.generateMarkdown({
          messages: [
            { role: "system", content: DRAFT_REPORT_PROMPT },
            { role: "user", content: draftUserMessage },
          ],
          model: llmClient.models.report,
          stream: false,
        });

        if (!draftResponse.ok) {
          const errText = await draftResponse.text();
          throw new Error(`Draft generation failed (${draftResponse.status}): ${errText}`);
        }

        const draftJson = await draftResponse.json();
        const draftReport =
          draftJson.choices?.[0]?.message?.content || "";
        timings.draft = Date.now() - t0;

        logDiagnosticEvent({
          traceId,
          stage: "draft",
          status: "success",
          action: "draft_completed",
          details: {
            draft_size_chars: draftReport.length,
            duration_ms: timings.draft,
          },
        });

        await sendProgress(3, "completed", { draft_size: draftReport.length });

        // ═══════════════════════════════════════════════════════
        // STEP 5: Audit
        // ═══════════════════════════════════════════════════════
        t0 = Date.now();
        await sendProgress(4, "running");

        logDiagnosticEvent({
          traceId,
          stage: "audit",
          status: "start",
          action: "auditing_report",
        });

        const auditResult = await auditReport(
          draftReport,
          factPack,
          engineResult,
          llmClient
        );
        timings.audit = Date.now() - t0;

        logDiagnosticEvent({
          traceId,
          stage: "audit",
          status: "success",
          action: "audit_completed",
          details: {
            issues: auditResult.issues.length,
            quality: auditResult.overall_quality,
            duration_ms: timings.audit,
          },
        });

        await sendProgress(4, "completed", auditResult);

        // ═══════════════════════════════════════════════════════
        // STEP 6: Final Report (streaming)
        // ═══════════════════════════════════════════════════════
        t0 = Date.now();
        await sendProgress(5, "running");

        logDiagnosticEvent({
          traceId,
          stage: "final_report",
          status: "start",
          action: "generating_final_report",
        });

        const finalUserMessage = `Produza a VERSÃO FINAL do relatório executivo.

RELATÓRIO DRAFT:
---
${draftReport}
---

ACHADOS DA AUDITORIA:
${JSON.stringify(auditResult, null, 2)}

FACT PACK:
${JSON.stringify(enrichedPayload, null, 2)}`;

        const finalResponse = await llmClient.generateMarkdown({
          messages: [
            { role: "system", content: FINAL_REPORT_PROMPT },
            { role: "user", content: finalUserMessage },
          ],
          model: llmClient.models.report,
          stream: true,
        });

        if (!finalResponse.ok) {
          const errText = await finalResponse.text();
          if (finalResponse.status === 429) {
            throw new Error("RATE_LIMIT");
          }
          if (finalResponse.status === 402) {
            throw new Error("INSUFFICIENT_CREDITS");
          }
          throw new Error(
            `Final report generation failed (${finalResponse.status}): ${errText}`
          );
        }

        // Pipe the OpenAI streaming response directly to our SSE stream
        if (finalResponse.body) {
          const reader = finalResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        }

        timings.final_report = Date.now() - t0;

        logDiagnosticEvent({
          traceId,
          stage: "final_report",
          status: "success",
          action: "final_report_streamed",
          details: {
            duration_ms: timings.final_report,
            total_pipeline_ms: Object.values(timings).reduce((a, b) => a + b, 0),
          },
        });

        // Send pipeline complete event with metadata
        await writer.write(
          sseEvent("pipeline_complete", {
            timings,
            total_duration_ms: Object.values(timings).reduce(
              (a, b) => a + b,
              0
            ),
          })
        );
      } catch (error) {
        console.error("Pipeline error:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Send error event
        await writer.write(
          sseEvent("pipeline_error", {
            error: errorMessage,
            step: "unknown",
          })
        );

        logDiagnosticEvent({
          traceId,
          stage: "edge_function",
          status: "error",
          action: "pipeline_failed",
          details: { error: errorMessage },
        });
      } finally {
        await writer.close();
      }
    })();

    // Return the readable stream immediately
    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("analyze error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
