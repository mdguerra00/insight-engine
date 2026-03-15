

# Diagnóstico: Pipeline travando em "Extraindo fatos financeiros"

## Causa raiz

**A `OPENAI_API_KEY` não existe nos secrets do projeto.** Apenas `LOVABLE_API_KEY` está configurada. O `llmClient.ts` tenta ler `Deno.env.get("OPENAI_API_KEY")` — que retorna `undefined` — e lança erro imediatamente na inicialização do client. Isso faz o pipeline inteiro falhar silenciosamente (o erro é enviado via SSE como `pipeline_error`, mas pode não estar sendo exibido corretamente no frontend).

A classificação (step 1) pode ter passado, mas a extração de fatos (step 2) trava porque a chamada LLM falha.

## Problemas encontrados

| # | Problema | Severidade |
|---|----------|-----------|
| 1 | `OPENAI_API_KEY` ausente nos secrets | **Crítico — bloqueia toda análise** |
| 2 | Build error: `SheetData.numeric_columns` tipo incompatível (`header` vs `column`) | **Bloqueante** |

## Plano de correção

### 1. Adicionar a secret `OPENAI_API_KEY`
Solicitar que você insira a chave via ferramenta de secrets para que a Edge Function consiga acessá-la.

### 2. Corrigir build error em `extractXlsx.ts`
O campo `numeric_columns` retorna objetos com `{ header, is_monetary, min, max, sum }` mas a interface `SheetData` espera `{ column, is_monetary }`. 

**Fix:** Atualizar a interface `SheetData` em `src/types/documents.ts` para aceitar os campos completos:
```typescript
numeric_columns?: Array<{
  header: string;
  is_monetary: boolean;
  min: number | null;
  max: number | null;
  sum: number;
}>;
```

