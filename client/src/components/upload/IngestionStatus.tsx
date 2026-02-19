'use client';

import type { IngestEvent } from '@/types';
import { ProgressBar } from './ProgressBar';

interface IngestionStatusProps {
  events: IngestEvent[];
  isIngesting: boolean;
  error: string | null;
}

interface FileProgress {
  total: number;
  stored: number;
  done: boolean;
}

export function IngestionStatus({ events, isIngesting, error }: IngestionStatusProps) {
  if (events.length === 0 && !isIngesting && !error) return null;

  // Build per-file progress map
  const fileProgress: Record<string, FileProgress> = {};
  const savedFiles: string[] = [];
  let isDone = false;

  for (const event of events) {
    if (event.type === 'file_saved' && event.file && !savedFiles.includes(event.file)) {
      savedFiles.push(event.file);
      fileProgress[event.file] = { total: 0, stored: 0, done: false };
    }
    if (event.type === 'chunks_start' && event.file) {
      fileProgress[event.file] = { total: event.total ?? 0, stored: 0, done: false };
    }
    if (event.type === 'batch_stored' && event.file) {
      fileProgress[event.file] = {
        ...fileProgress[event.file],
        stored: event.stored ?? 0,
        total: event.total ?? fileProgress[event.file]?.total ?? 0,
        done: false,
      };
    }
    if (event.type === 'file_done' && event.file) {
      fileProgress[event.file] = { ...fileProgress[event.file], done: true };
    }
    if (event.type === 'done') {
      isDone = true;
    }
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      <div className="flex items-center gap-2">
        {isIngesting && (
          <div className="w-4 h-4 border-2 border-[#667eea] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {isDone && <span className="text-green-600">✅</span>}
        <span className="text-sm font-medium text-gray-700">
          {isDone ? 'Ingestion complete!' : isIngesting ? 'Processing documents…' : 'Status'}
        </span>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
          ❌ {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {savedFiles.map((file) => {
          const progress = fileProgress[file];
          const pct =
            progress?.total > 0
              ? Math.round((progress.stored / progress.total) * 100)
              : progress?.done
              ? 100
              : isIngesting
              ? 10
              : 0;

          return (
            <div key={file} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[80%]">
                  📄 {file}
                </span>
                {progress?.done && <span className="text-green-500 text-xs">Done</span>}
              </div>
              <ProgressBar
                value={pct}
                label={
                  progress?.total > 0
                    ? `${progress.stored}/${progress.total} chunks`
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
