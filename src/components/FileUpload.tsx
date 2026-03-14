import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const ACCEPTED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv'];

export function FileUpload({ onFilesSelected, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList).filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return ACCEPTED_TYPES.includes(f.type) || ACCEPTED_EXTENSIONS.includes(ext);
    });
    if (valid.length > 0) {
      onFilesSelected(valid);
    }
  }, [onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-border'
      } ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
      onClick={() => {
        if (disabled) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = ACCEPTED_EXTENSIONS.join(',');
        input.onchange = () => handleFiles(input.files);
        input.click();
      }}
    >
      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground mb-1">
        Arraste arquivos ou clique para selecionar
      </p>
      <p className="text-xs text-muted-foreground">
        PDF, XLSX, CSV — máximo 20MB por arquivo
      </p>
    </div>
  );
}
