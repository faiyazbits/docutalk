'use client';

interface ConversationStartersProps {
  onSelect: (text: string) => void;
}

const STARTERS = [
  'What topics are covered in the uploaded documents?',
  'Summarize the key concepts from the documents.',
  'What are the most important points I should know?',
];

export function ConversationStarters({ onSelect }: ConversationStartersProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">📚</div>
        <h2 className="text-2xl font-black text-black mb-2">Ask about your documents</h2>
        <p className="text-gray-600 text-sm">
          Your PDFs are ready. Start a conversation below.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-lg">
        {STARTERS.map((text) => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            className="text-left px-5 py-4 border-2 border-black bg-white shadow-[3px_3px_0px_#000] hover:bg-[#FFE500] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all text-black text-sm font-medium cursor-pointer"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
