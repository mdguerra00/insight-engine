# Fase 0 — Congelamento e diagnóstico

## Branch de estabilização

Recomendação de branch para esta fase:

- `stabilization/fase-0-diagnostico`

## Fluxo ponta a ponta mapeado

1. **Upload** (`src/pages/Index.tsx`)
   - `handleFilesSelected` recebe arquivos.
   - Cria `docId` e `storagePath`.
   - Faz upload para bucket `documents`.
   - Persiste metadados na tabela `documents`.

2. **Extraction** (`src/pages/Index.tsx` + `src/lib/extractors/*`)
   - Escolhe extractor por tipo (`pdf`, `xlsx`, `csv`).
   - Captura `status`, `preview_text`, `extracted_text` e/ou `extracted_json`.
   - Persiste resultado em `document_extractions`.

3. **Payload** (`src/lib/buildAnalysisPayload.ts`)
   - Filtra apenas documentos com `extraction_status = extracted`.
   - Monta estrutura por tipo de fonte (`pdf`, `xlsx`, `csv`).

4. **Edge function** (`supabase/functions/analyze/index.ts`)
   - Recebe `{ payload, trace_id }`.
   - Valida presença de documentos no payload.
   - Monta mensagem com `SYSTEM_PROMPT` + payload serializado.
   - Encaminha para gateway de IA em modo streaming.

5. **Report** (`src/pages/Index.tsx`)
   - Consome SSE (`data:`) do endpoint de análise.
   - Concatena deltas para construir `fullReport`.

6. **Save** (`src/pages/Index.tsx`)
   - Persiste relatório em `analysis_reports`.
   - Persiste vínculos em `report_documents`.

## Estratégia de logs estruturados

Todos os logs usam o prefixo `[diagnostic]` e `trace_id` para correlação.

- Frontend (`src/lib/structuredLogger.ts`, `src/pages/Index.tsx`):
  - `upload`: start / success / error
  - `extraction`: start / success / error
  - `payload`: start / success
  - `edge_function`: start / success / error
  - `report`: success / error
  - `save`: success
- Edge function (`supabase/functions/analyze/index.ts`):
  - `edge_function`: start / error
  - `prompt`: info
  - `model_call`: start / success / error

Com isso, é possível distinguir claramente falhas por etapa:
- upload
- parsing/extraction
- montagem de payload
- chamada do modelo
- prompt/contexto enviado
