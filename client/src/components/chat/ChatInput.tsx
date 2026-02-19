'use client';

import { type FormEvent, type ChangeEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  onStop?: () => void;
}

export function ChatInput({ value, onChange, onSubmit, isLoading, onStop }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        e.currentTarget.form?.requestSubmit();
      }
    }
  };

  return (
    <div className="border-t-2 border-black bg-[#FFFBF0] px-4 py-3">
      <form onSubmit={onSubmit} className="flex gap-3 items-end max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents… (Shift+Enter for newline)"
          rows={1}
          className="flex-1 resize-none border-2 border-black px-4 py-3 text-sm focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-shadow leading-relaxed max-h-[200px] overflow-y-auto bg-white"
          disabled={isLoading}
        />

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="flex-shrink-0 w-11 h-11 bg-[#FF5757] border-2 border-black shadow-[3px_3px_0px_#000] text-white flex items-center justify-center hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
            title="Stop generating"
          >
            <span className="w-3 h-3 bg-white" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex-shrink-0 w-11 h-11 bg-[#FFE500] border-2 border-black shadow-[3px_3px_0px_#000] text-black flex items-center justify-center hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_#000]"
            title="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </form>
      <p className="text-xs text-gray-500 text-center mt-2">
        AI responses may not always be accurate. Verify important information.
      </p>
    </div>
  );
}
