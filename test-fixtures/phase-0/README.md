# Fase 0 — Arquivos de teste padrão

Este conjunto cobre o diagnóstico mínimo solicitado sem bloquear aplicação de PR por binários.

## Arquivos versionados

1. `contabil_padrao.csv`
   - CSV contábil com lançamentos de débito e crédito.

2. `caso_misto_reconciliavel.csv`
   - Caso misto com números reconciliáveis entre nota fiscal, extrato e retenções.

3. `generate_binary_fixtures.py`
   - Script para gerar localmente os binários:
     - `pdf_textual_padrao.pdf`
     - `xlsx_simples_padrao.xlsx`

## Como gerar os binários localmente

```bash
python test-fixtures/phase-0/generate_binary_fixtures.py
```

## Uso sugerido

- Upload individual para validar cada extractor.
- Upload conjunto dos 4 arquivos para validar reconciliação no payload e na geração do relatório.
- Em caso de falha, filtrar logs por `trace_id` com prefixo `[diagnostic]`.
