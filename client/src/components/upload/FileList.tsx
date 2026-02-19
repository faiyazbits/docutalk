'use client';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({ files, onRemove, disabled }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Selected files ({files.length})
      </p>
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2.5 gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-red-500 text-lg flex-shrink-0">📄</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
            </div>
          </div>
          {!disabled && (
            <button
              onClick={() => onRemove(index)}
              className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
              title="Remove file"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
