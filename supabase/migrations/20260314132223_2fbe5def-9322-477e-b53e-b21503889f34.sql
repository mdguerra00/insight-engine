-- Documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document extractions table
CREATE TABLE public.document_extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  detected_type TEXT,
  preview_text TEXT,
  extracted_text TEXT,
  extracted_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Analysis reports table
CREATE TABLE public.analysis_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_text TEXT NOT NULL,
  report_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Report-documents junction table
CREATE TABLE public.report_documents (
  report_id UUID NOT NULL REFERENCES public.analysis_reports(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, document_id)
);

-- Enable RLS on all tables
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_documents ENABLE ROW LEVEL SECURITY;

-- For MVP without auth, allow all operations (public access)
CREATE POLICY "Allow all on documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on document_extractions" ON public.document_extractions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on analysis_reports" ON public.analysis_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on report_documents" ON public.report_documents FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_document_extractions_document_id ON public.document_extractions(document_id);
CREATE INDEX idx_report_documents_report_id ON public.report_documents(report_id);
CREATE INDEX idx_report_documents_document_id ON public.report_documents(document_id);

-- Storage bucket for uploaded documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Allow upload to documents bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow read from documents bucket" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Allow delete from documents bucket" ON storage.objects FOR DELETE USING (bucket_id = 'documents');