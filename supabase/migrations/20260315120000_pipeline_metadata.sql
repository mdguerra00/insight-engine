-- Phase 10: Add pipeline metadata columns to analysis_reports
-- Stores fact pack, audit results, classifications, and pipeline timings

ALTER TABLE public.analysis_reports
  ADD COLUMN IF NOT EXISTS fact_pack_json JSONB,
  ADD COLUMN IF NOT EXISTS audit_json JSONB,
  ADD COLUMN IF NOT EXISTS classifications_json JSONB,
  ADD COLUMN IF NOT EXISTS engine_result_json JSONB,
  ADD COLUMN IF NOT EXISTS pipeline_timings JSONB,
  ADD COLUMN IF NOT EXISTS entity_name TEXT,
  ADD COLUMN IF NOT EXISTS period_detected TEXT,
  ADD COLUMN IF NOT EXISTS draft_text TEXT;

-- Index for future queries by entity/period
CREATE INDEX IF NOT EXISTS idx_analysis_reports_entity
  ON public.analysis_reports(entity_name)
  WHERE entity_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_reports_period
  ON public.analysis_reports(period_detected)
  WHERE period_detected IS NOT NULL;
