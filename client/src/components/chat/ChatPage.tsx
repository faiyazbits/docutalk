'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import Link from 'next/link';
import { useUserContext } from '@/hooks/useUserContext';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ConversationStarters } from './ConversationStarters';
import type { ToolAnnotation } from '@/types';

export function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { buildContext } = useUserContext();
  const contextRef = useRef(buildContext);
  contextRef.current = buildContext;

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    data,
    append,
    stop,
    setMessages,
  } = useChat({
    api: '/api/chat',
    body: {
      sessionId,
      context: contextRef.current(),
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Extract sessionId from data annotations after first response
  useEffect(() => {
    if (sessionId || !data?.length) return;
    for (const item of data) {
      const annotation = item as unknown as ToolAnnotation;
      if (annotation.type === 'session' && annotation.sessionId) {
        setSessionId(annotation.sessionId);
        break;
      }
    }
  }, [data, sessionId]);

  const toolAnnotations = (data ?? [])
    .map((d) => d as unknown as ToolAnnotation)
    .filter((d) => d.type !== 'session');

  const handleStarterSelect = (text: string) => {
    append({ role: 'user', content: text });
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#FFFBF0]">
      {/* Header */}
      <header className="flex-shrink-0 bg-black px-4 py-3 flex items-center justify-between border-b-2 border-black shadow-[0_4px_0px_#000]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h1 className="text-[#FFE500] font-black text-lg leading-tight tracking-tight">DocuTalk</h1>
            <p className="text-white/60 text-xs">Document AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-black text-xs px-3 py-1.5 border-2 border-black bg-white shadow-[2px_2px_0px_#FFE500] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
            >
              Clear chat
            </button>
          )}
          <Link
            href="/"
            className="text-black text-xs px-3 py-1.5 border-2 border-black bg-[#FFE500] shadow-[2px_2px_0px_#fff] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
          >
            + Upload docs
          </Link>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-[#FFFBF0]">
        {messages.length === 0 && !isLoading ? (
          <ConversationStarters onSelect={handleStarterSelect} />
        ) : (
          <ChatMessages
            messages={messages}
            toolAnnotations={toolAnnotations}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Input area */}
      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onStop={stop}
      />
    </div>
  );
}
