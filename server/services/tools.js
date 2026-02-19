import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ragService } from './RAGService.js';

/**
 * Tool: list all ingested document filenames from ChromaDB.
 * Accesses ragService.vectorStore lazily (at call time, not at module load time)
 * so the circular import with RAGService.js is safe.
 */
const listDocuments = new DynamicStructuredTool({
  name: 'list_documents',
  description:
    'List all document filenames that have been ingested into the knowledge base. Use this when the user asks what documents are available or what files have been uploaded.',
  schema: z.object({}),
  func: async () => {
    const vectorStore = ragService.vectorStore;
    try {
      const result = await vectorStore._collection.get();
      const sources = result.metadatas?.map((m) => m?.source).filter(Boolean);
      const unique = [...new Set(sources)];
      if (unique.length === 0) {
        return 'No documents have been ingested yet.';
      }
      const list = unique.map((s, i) => `${i + 1}. ${s.split('/').pop()}`).join('\n');
      return `The following documents are in the knowledge base:\n${list}`;
    } catch (error) {
      return `Error listing documents: ${error.message}`;
    }
  },
});

/**
 * Tool: generate a focused summary of a topic from the ingested documents.
 * Performs a vector search then calls the LLM with a format-specific prompt.
 */
const summarizeTopic = new DynamicStructuredTool({
  name: 'summarize_topic',
  description:
    'Generate a focused summary of a specific topic from the ingested documents. Use this when the user asks for a summary or overview of a particular subject.',
  schema: z.object({
    topic: z.string().describe('The topic to summarize from the documents'),
    format: z
      .enum(['brief', 'detailed', 'bullet_points'])
      .default('brief')
      .describe('How verbose the summary should be'),
  }),
  func: async ({ topic, format }) => {
    const vectorStore = ragService.vectorStore;
    const llm = ragService.rawLlm;
    try {
      const retriever = vectorStore.asRetriever({ k: 6, searchType: 'similarity' });
      const docs = await retriever.invoke(topic);

      if (docs.length === 0) {
        return `No relevant content found for topic: "${topic}"`;
      }

      const context = docs
        .map((doc, i) => `[Excerpt ${i + 1}]\n${doc.pageContent}`)
        .join('\n\n---\n\n');

      const formatInstructions = {
        brief: 'Write a concise 2-3 sentence summary.',
        detailed: 'Write a thorough multi-paragraph summary covering all key points.',
        bullet_points: 'Write a summary as a bulleted list of key points, one per line.',
      };

      const prompt = `You are summarizing content from documents. Based on the excerpts below, ${formatInstructions[format]}

Topic: ${topic}

${context}

Summary:`;

      const response = await llm.invoke(prompt);
      return response.content;
    } catch (error) {
      return `Error summarizing topic: ${error.message}`;
    }
  },
});

/**
 * Get all available tools.
 * Called by RAGService.initialize() — tools access ragService lazily inside func,
 * so they work correctly even though this is called early in initialization.
 * @returns {DynamicStructuredTool[]}
 */
export const getAvailableTools = () => [listDocuments, summarizeTopic];
