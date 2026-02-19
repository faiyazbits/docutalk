'use client';

import { useEffect, useRef } from 'react';
import type { Message } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { ToolStatus } from './ToolStatus';
import type { ToolAnnotation } from '@/types';

interface ChatMessagesProps {
  messages: Message[];
  toolAnnotations: ToolAnnotation[];
  isLoading: boolean;
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  h1: ({ children }) => <h1 className="font-black text-xl mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="font-black text-lg mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre className="bg-gray-900 text-gray-100 p-3 font-mono text-xs overflow-x-auto border-2 border-black my-2">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-gray-100 px-1 font-mono text-xs border border-black">{children}</code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  a: ({ href, children }) => (
    <a href={href} className="underline text-blue-700 hover:text-blue-900">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-black pl-3 italic text-gray-600 my-2">
      {children}
    </blockquote>
  ),
};

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4 py-1`}>
      {!isUser && (
        <div className="w-8 h-8 bg-[#FFE500] border-2 border-black flex items-center justify-center text-black text-xs font-black mr-2 flex-shrink-0 mt-1">
          AI
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed border-2 border-black ${
          isUser
            ? 'bg-[#FFE500] text-black shadow-[3px_3px_0px_#000]'
            : 'bg-white text-black shadow-[3px_3px_0px_#000]'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start px-4 py-1">
      <div className="w-8 h-8 bg-[#FFE500] border-2 border-black flex items-center justify-center text-black text-xs font-black mr-2 flex-shrink-0">
        AI
      </div>
      <div className="bg-white border-2 border-black px-4 py-3 shadow-[3px_3px_0px_#000]">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function ChatMessages({ messages, toolAnnotations, isLoading }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === 'assistant');
  const isLastAssistant = lastAssistantIndex === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col gap-1 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Show tool events after the last user message while loading */}
      {isLoading && toolAnnotations.length > 0 && isLastAssistant && (
        <ToolStatus annotations={toolAnnotations} />
      )}

      {/* Show thinking indicator when loading and no assistant message yet or last is user */}
      {isLoading && (messages.length === 0 || messages.at(-1)?.role === 'user') && (
        <ThinkingIndicator />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
