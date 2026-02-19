'use client';

import { useState, useCallback } from 'react';
import type { IngestEvent } from '@/types';

interface UseIngestSSEReturn {
  events: IngestEvent[];
  isIngesting: boolean;
  error: string | null;
  startIngest: (files: File[]) => Promise<void>;
  reset: () => void;
}

export function useIngestSSE(): UseIngestSSEReturn {
  const [events, setEvents] = useState<IngestEvent[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setEvents([]);
    setIsIngesting(false);
    setError(null);
  }, []);

  const startIngest = useCallback(async (files: File[]) => {
    setEvents([]);
    setError(null);
    setIsIngesting(true);

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/ingest`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: IngestEvent = JSON.parse(line.slice(6));
            setEvents((prev) => [...prev, event]);
            if (event.type === 'done' || event.type === 'error') {
              if (event.type === 'error') setError(event.message ?? 'Ingestion failed');
              setIsIngesting(false);
              return;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsIngesting(false);
    }
  }, []);

  return { events, isIngesting, error, startIngest, reset };
}
