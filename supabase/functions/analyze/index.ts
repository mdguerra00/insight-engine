import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLlmClient } from "./llmClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DiagnosticStatus = "start" | "success" | "error" | "info";

function logDiagnosticEvent(params: {
  traceId: string;
  stage: "edge_function" | "prompt" | "model_call";
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
    return;
  }

  console.log("[diagnostic]", payload);
}

const SYSTEM_PROMPT = `Você é um analista empresarial, financeiro, contábil e fiscal de altíssimo nível.

Sua tarefa é analisar profundamente documentos empresariais fornecidos pelo sistema e produzir um relatório executivo preciso, rigoroso e útil para tomada de decisão.

IMPORTANTE:
Você NÃO deve assumir previamente o contexto da empresa, setor ou natureza da operação.
O contexto deve ser inferido a partir dos próprios documentos.
O objetivo não é resumir documentos, mas reconstruir a realidade econômica, financeira, fiscal e operacional implícita neles.

METODOLOGIA OBRIGATÓRIA:
1. Identifique o tipo provável de cada documento.
2. Extraia os fatos concretos presentes nos dados.
3. Normalize números, datas, percentuais e períodos.
4. Cruze informações entre documentos.
5. Verifique consistência entre números quando possível.
6. Calcule indicadores derivados quando houver base suficiente.
7. Separe claramente:
   - fatos explícitos
   - cálculos derivados
   - interpretações plausíveis
   - limitações ou incertezas

REGRAS DE FORMATAÇÃO DE NÚMEROS:
- SEMPRE prefixe valores monetários com o símbolo da moeda (R$, US$, EUR, etc.).
- SEMPRE indique a grandeza explicitamente: mil, milhões, bilhões. Exemplo: "R$ 4,2 bilhões", "R$ 697 milhões", "R$ 44 milhões".
- NUNCA apresente números monetários soltos sem moeda e grandeza (ex: NÃO escreva "4.207", escreva "R$ 4,2 bilhões" ou "R$ 4.207 milhões").
- Defina a unidade padrão no início de cada seção com tabelas numéricas (ex: "Valores em R$ milhões") E TAMBÉM repita o símbolo da moeda em cada valor individual.
- Para percentuais, sempre inclua o símbolo % e indique se é variação (Δ), taxa ou proporção.
- Use separador de milhar com ponto e decimal com vírgula no padrão brasileiro (ex: R$ 1.234,5 milhões).
- Quando a moeda não puder ser inferida do documento, indique explicitamente a incerteza.

REGRAS IMPORTANTES:
- Nunca invente números ausentes.
- Sempre diferencie movimentação fiscal de faturamento econômico.
- Sempre diferencie saldo de fluxo.
- Sempre diferencie competência de caixa.
- Sempre diferencie crédito fiscal de imposto pago.
- Nunca apresente inferências como fatos.
- Se não houver dados suficientes para uma conclusão, diga explicitamente.
- Prefira profundidade analítica a generalizações superficiais.

FORMATO OBRIGATÓRIO DO RELATÓRIO:
1. Classificação dos documentos
2. Fatos principais extraídos
3. Reconciliações e checagens
4. Indicadores derivados
5. Leitura gerencial
6. Pontos de atenção e limitações
7. Conclusão executiva

ESTILO:
- parecer profissional de consultoria
- claro e direto
- sem jargão desnecessário
- sem frases genéricas
- explicar a lógica das conclusões`;

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
      return new Response(JSON.stringify({ error: "JSON inválido no corpo da requisição." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payload, trace_id: traceIdFromRequest } = body;
    const traceId = typeof traceIdFromRequest === "string" && traceIdFromRequest
      ? traceIdFromRequest
      : crypto.randomUUID();

    logDiagnosticEvent({
      traceId,
      stage: "edge_function",
      status: "start",
      action: "request_received",
    });
    
    if (!payload || !Array.isArray(payload.documents) || payload.documents.length === 0) {
      logDiagnosticEvent({
        traceId,
        stage: "edge_function",
        status: "error",
        action: "invalid_payload",
      });
      return new Response(
        JSON.stringify({ error: "Nenhum documento com conteúdo extraído fornecido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    logDiagnosticEvent({
      traceId,
      stage: "prompt",
      status: "info",
      action: "prompt_prepared",
      details: {
        document_count: payload.documents.length,
        source_types: payload.documents.map((doc: { source_type?: string }) => doc.source_type ?? "unknown"),
      },
    });

    const userMessage = `Analise os seguintes documentos empresariais e produza o relatório executivo conforme as instruções.

Dados dos documentos:

${JSON.stringify(payload, null, 2)}`;

    logDiagnosticEvent({
      traceId,
      stage: "model_call",
      status: "start",
      action: "provider_request_started",
      details: {
        provider: "openai",
        model: llmClient.models.report,
      },
    });

    const response = await llmClient.generateMarkdown({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      model: llmClient.models.report,
      stream: true,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      logDiagnosticEvent({
        traceId,
        stage: "model_call",
        status: "error",
        action: "provider_request_failed",
        details: {
          status_code: response.status,
          body: t,
        },
      });
      console.error("OpenAI request error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao chamar o modelo de IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logDiagnosticEvent({
      traceId,
      stage: "model_call",
      status: "success",
      action: "provider_stream_ready",
    });

    return new Response(response.body, {
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
