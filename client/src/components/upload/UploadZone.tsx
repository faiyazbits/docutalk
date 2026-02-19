'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadZone({ onFiles, disabled }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!disabled) onFiles(acceptedFiles);
    },
    [onFiles, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 50 * 1024 * 1024, // 50 MB
    maxFiles: 10,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed border-black p-10 text-center cursor-pointer transition-all duration-200 ${
        disabled
          ? 'bg-gray-100 cursor-not-allowed opacity-60'
          : isDragActive
          ? 'bg-[#FFE500]'
          : 'bg-white hover:bg-[#FFFBF0]'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl">{isDragActive ? '📂' : '📁'}</span>
        <div>
          <p className="font-black text-black">
            {isDragActive ? 'Drop your PDFs here' : 'Drag & drop PDF files'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or <span className="text-black font-bold underline">click to browse</span>
          </p>
        </div>
        <p className="text-xs text-gray-500">PDF only · up to 50 MB per file · max 10 files</p>
      </div>
    </div>
  );
}
