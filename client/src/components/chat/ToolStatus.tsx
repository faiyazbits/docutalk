'use client';

import type { ToolAnnotation } from '@/types';

interface ToolStatusProps {
  annotations: ToolAnnotation[];
}

export function ToolStatus({ annotations }: ToolStatusProps) {
  const executing = annotations.filter((a) => a.type === 'tool_executing');
  const results = annotations.filter((a) => a.type === 'tool_result');
  const errors = annotations.filter((a) => a.type === 'tool_error');

  if (executing.length === 0 && results.length === 0 && errors.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      {executing.map((a, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-xs text-black bg-[#FFE500] border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-2 font-medium"
        >
          <span className="animate-spin">⚙️</span>
          <span>Running: {a.tools?.join(', ')}</span>
        </div>
      ))}
      {results.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 text-xs text-black bg-[#6BCB77] border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-2"
        >
          <span>✅</span>
          <div>
            <span className="font-bold">{a.tool}</span>
            {a.result && (
              <p className="mt-0.5 whitespace-pre-wrap">{a.result}</p>
            )}
          </div>
        </div>
      ))}
      {errors.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 text-xs text-white bg-[#FF5757] border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-2"
        >
          <span>❌</span>
          <div>
            <span className="font-bold">{a.tool}</span>
            {a.error && <p className="mt-0.5">{a.error}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
