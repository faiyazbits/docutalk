import { RunnableSequence } from '@langchain/core/runnables';
import { ChatDeepSeek } from '@langchain/deepseek';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getAvailableTools } from './tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SYSTEM_PROMPT_PATH = join(__dirname, '../prompts/system.md');

const BASE_RAG_INSTRUCTION = `You are a helpful AI assistant with access to a knowledge base. Use the following context to answer the user's question accurately and concisely.
If the context doesn't contain enough information to answer the question, politely say that you don't have enough information rather than making up an answer.`;

class RAGService {
  constructor() {
    this.llm = null;
    this.rawLlm = null;
    this.vectorStore = null;
    this.prompt = null;
    this.contextRetriever = null;
    this.ragChain = null;
    this.tools = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log('🔗 Initializing RAGService...');

    this.tools = getAvailableTools();
    console.log(`🔧 Loaded ${this.tools.length} tool(s):`, this.tools.map((t) => t.name).join(', '));

    this.rawLlm = new ChatDeepSeek({
      modelName: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 2000,
      streaming: true,
      verbose: !!process.env.DEBUG_PROMPTS,
      apiKey: process.env.DEEPSEEK_API_KEY,
      configuration: { baseURL: 'https://api.deepseek.com' },
    });
    this.llm = this.tools.length > 0 ? this.rawLlm.bind({ tools: this.tools }) : this.rawLlm;
    console.log('🤖 LLM initialized');

    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorStore = new Chroma(embeddings, {
      collectionName: process.env.CHROMA_COLLECTION || 'rag-collection',
      url: process.env.CHROMA_URL || 'http://localhost:8000',
    });
    console.log(`📚 Vector store connected to ${process.env.CHROMA_URL}`);

    let systemPrompt = '';
    try {
      systemPrompt = await readFile(SYSTEM_PROMPT_PATH, 'utf-8');
      console.log('📄 System prompt loaded from:', SYSTEM_PROMPT_PATH);
    } catch (e) {
      console.warn('⚠️ System prompt not found:', e.message);
    }
    const systemMessage = systemPrompt
      ? `${systemPrompt}\n\n---\n\n${BASE_RAG_INSTRUCTION}`
      : BASE_RAG_INSTRUCTION;

    this.prompt = ChatPromptTemplate.fromMessages([
      ['system', systemMessage],
      new MessagesPlaceholder('chat_history'),
      ['user', `Context:\n{context}\n\nQuestion: {question}`],
    ]);
    console.log('📝 Prompt template created');

    const retriever = this.vectorStore.asRetriever({ k: 4, searchType: 'similarity' });
    this.contextRetriever = async (question) => {
      console.log('🔍 RAG Query:', question);
      const docs = await retriever.invoke(question);
      console.log(`📄 Retrieved ${docs.length} document(s)`);
      if (docs.length > 0) {
        docs.forEach((doc, idx) => {
          console.log(`  [Doc ${idx + 1}] ${doc.pageContent.substring(0, 100)}...`);
        });
      } else {
        console.log('  ⚠️ No documents found for query');
      }
      return docs
        .map((doc, idx) => `[Document ${idx + 1}]\n${doc.pageContent}`)
        .join('\n\n---\n\n');
    };

    this.ragChain = RunnableSequence.from([
      {
        context: (input) => this.contextRetriever(input.question),
        question: (input) => input.question,
        chat_history: (input) => input.chat_history || [],
      },
      this.prompt,
      this.llm,
    ]);

    this.initialized = true;
    console.log('✅ RAGService initialized');
  }

  async getChain() {
    await this.initialize();
    return {
      ragChain: this.ragChain,
      tools: this.tools,
      llm: this.rawLlm, // Raw (unbound) LLM for synthesis — no tool recursion
      contextRetriever: this.contextRetriever,
    };
  }
}

export const ragService = new RAGService();
