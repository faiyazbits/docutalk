'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadZone } from './UploadZone';
import { FileList } from './FileList';
import { IngestionStatus } from './IngestionStatus';
import { useIngestSSE } from '@/hooks/useIngestSSE';

export function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const { events, isIngesting, error, startIngest, reset } = useIngestSSE();

  const isDone = events.some((e) => e.type === 'done');

  const handleFiles = (newFiles: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const unique = newFiles.filter((f) => !existing.has(f.name));
      return [...prev, ...unique];
    });
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || isIngesting) return;
    reset();
    await startIngest(files);
  };

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('docutalk:skip-upload', '1');
    }
    router.push('/chat');
  };

  const handleGoToChat = () => {
    router.push('/chat');
  };

  return (
    <div className="min-h-screen bg-[#FFFBF0] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📚</div>
          <h1 className="text-3xl font-black text-black mb-1">DocuTalk</h1>
          <p className="text-gray-600 text-sm">Upload your PDFs and chat with them instantly</p>
        </div>

        {/* Card */}
        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_#000] p-6">
          <UploadZone onFiles={handleFiles} disabled={isIngesting} />

          <FileList files={files} onRemove={handleRemove} disabled={isIngesting} />

          <IngestionStatus events={events} isIngesting={isIngesting} error={error} />

          <div className="flex flex-col gap-3 mt-6">
            {isDone ? (
              <button
                onClick={handleGoToChat}
                className="w-full py-3 bg-[#6BCB77] border-2 border-black shadow-[3px_3px_0px_#000] text-black font-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
              >
                Go to Chat →
              </button>
            ) : (
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || isIngesting}
                className="w-full py-3 bg-[#FFE500] border-2 border-black shadow-[3px_3px_0px_#000] text-black font-black hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2"
              >
                {isIngesting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processing…
                  </>
                ) : (
                  'Upload & Process'
                )}
              </button>
            )}

            <button
              onClick={handleSkip}
              disabled={isIngesting}
              className="w-full py-2.5 text-sm text-gray-600 hover:text-black font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed underline"
            >
              Skip — use existing documents
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-4">
          Documents are processed and stored locally in ChromaDB
        </p>
      </div>
    </div>
  );
}
