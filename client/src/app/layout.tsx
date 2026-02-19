import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocuTalk',
  description: 'AI-powered document chat — upload PDFs and ask questions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#FFFBF0]">{children}</body>
    </html>
  );
}
