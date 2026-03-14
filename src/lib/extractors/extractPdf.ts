import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface PdfExtractionResult {
  status: 'extracted' | 'low_content' | 'failed';
  text: string;
  preview: string;
  pageCount: number;
  error?: string;
}

export async function extractPdf(file: File): Promise<PdfExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    const trimmed = fullText.trim();
    
    if (!trimmed || trimmed.length < 50) {
      return {
        status: 'low_content',
        text: trimmed,
        preview: trimmed || '(Documento sem texto legível)',
        pageCount,
      };
    }

    return {
      status: 'extracted',
      text: trimmed,
      preview: trimmed.slice(0, 500),
      pageCount,
    };
  } catch (error) {
    return {
      status: 'failed',
      text: '',
      preview: '',
      pageCount: 0,
      error: error instanceof Error ? error.message : 'Erro ao extrair PDF',
    };
  }
}
