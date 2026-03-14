import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  try {
    const { payload } = await req.json();
    
    if (!payload || !payload.documents || payload.documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum documento com conteúdo extraído fornecido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userMessage = `Analise os seguintes documentos empresariais e produza o relatório executivo conforme as instruções.

Dados dos documentos:

${JSON.stringify(payload, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
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
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao chamar o modelo de IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
