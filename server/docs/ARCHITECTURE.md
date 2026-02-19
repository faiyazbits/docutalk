# Docutalk Server: First Principles Deep Dive

This document explains how this LLM-powered chatbot works from first principles, what LangChain abstracts away, and analysis of the architectural tradeoffs.

---

## 1. CORE CONCEPTS: What's Really Happening Under the Hood

### 1.1 What is an LLM Call?

At its core, an LLM is just an HTTP API call. Without LangChain, it would look like this:

```javascript
// What you'd write WITHOUT LangChain:
const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a helpful assistant...' },
      { role: 'user', content: 'What does the uploaded document say about the methodology?' }
    ],
    temperature: 0.7,
    max_tokens: 2000,
    stream: true,  // SSE streaming
    tools: [...]   // Tool definitions (JSON schema)
  })
});
```

**What LangChain abstracts:**
```javascript
// server/services/RAGService.js:42-50
this.llm = new ChatDeepSeek({
  modelName: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2000,
  streaming: true,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: 'https://api.deepseek.com' },
});
```

**Pros:** Clean API, provider-agnostic (swap DeepSeek for OpenAI easily)
**Cons:** Hidden complexity, harder to debug HTTP-level issues, extra dependency

---

### 1.2 What is an Embedding?

An embedding converts text into a dense vector (array of floats). Similar texts have similar vectors.

```javascript
// WITHOUT LangChain - raw OpenAI API:
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: 'What are the key findings in the document?'
  })
});
// Returns: { embedding: [0.023, -0.041, 0.019, ... 1536 floats] }
```

**What LangChain abstracts:**
```javascript
// server/config/chroma.js:10-13
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY,
});
```

---

### 1.3 What is a Vector Store?

A vector store (ChromaDB here) is a specialized database for similarity search:

```
User Query: "What does the document say about the methodology?"
     ↓
Embed query → [0.02, -0.04, ...1536 floats]
     ↓
Find k nearest vectors in database (cosine similarity)
     ↓
Return associated text chunks
```

**WITHOUT LangChain - raw ChromaDB:**
```javascript
import { ChromaClient } from 'chromadb';

const client = new ChromaClient({ path: 'http://localhost:8000' });
const collection = await client.getOrCreateCollection({ name: 'rag-collection' });

// Store a document
await collection.add({
  ids: ['doc-1'],
  embeddings: [[0.02, -0.04, ...]], // You compute this yourself
  documents: ['The methodology section describes a three-phase approach...'],
  metadatas: [{ source: 'research-paper.pdf', page: 1 }]
});

// Query
const results = await collection.query({
  queryEmbeddings: [[0.03, -0.05, ...]], // Embed user query first
  nResults: 4
});
```

**What LangChain abstracts:**
```javascript
// server/services/RAGService.js:60-63
this.vectorStore = new Chroma(embeddings, {
  collectionName: process.env.CHROMA_COLLECTION || 'rag-collection',
  url: process.env.CHROMA_URL || 'http://localhost:8000',
});
```

---

## 2. RAG (Retrieval Augmented Generation) Explained

RAG is a pattern, not magic. Here's what actually happens:

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAG FLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: "What are the document's main conclusions?"              │
│           ↓                                                      │
│  ┌───────────────────┐                                          │
│  │ 1. EMBED QUERY    │  → [0.02, -0.04, 0.01, ...]             │
│  └───────────────────┘                                          │
│           ↓                                                      │
│  ┌───────────────────┐                                          │
│  │ 2. VECTOR SEARCH  │  → Find 4 most similar chunks           │
│  │    (ChromaDB)     │                                          │
│  └───────────────────┘                                          │
│           ↓                                                      │
│  Retrieved chunks:                                               │
│  - "The study concludes that the proposed method..."            │
│  - "Our findings indicate a 40% improvement over..."            │
│  - "In summary, the three key outcomes were..."                 │
│  - "Future work should address limitations in..."               │
│           ↓                                                      │
│  ┌───────────────────┐                                          │
│  │ 3. BUILD PROMPT   │                                          │
│  └───────────────────┘                                          │
│                                                                  │
│  System: You are Docutalk, a helpful assistant...               │
│  Context:                                                        │
│  [Document 1] The study concludes that the proposed method...   │
│  [Document 2] Our findings indicate a 40% improvement over...   │
│  ...                                                             │
│  Question: What are the document's main conclusions?            │
│           ↓                                                      │
│  ┌───────────────────┐                                          │
│  │ 4. LLM GENERATES  │  → Response grounded in context         │
│  └───────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**The actual code that does this:**

```javascript
// server/services/RAGService.js:84-99 - Context retrieval
const retriever = this.vectorStore.asRetriever({ k: 4, searchType: 'similarity' });

this.contextRetriever = async (question) => {
  const docs = await retriever.invoke(question);  // Vector search
  return docs
    .map((doc, idx) => `[Document ${idx + 1}]\n${doc.pageContent}`)
    .join('\n\n---\n\n');
};

// server/services/RAGService.js:101-109 - The RAG chain
this.ragChain = RunnableSequence.from([
  {
    context: (input) => this.contextRetriever(input.question),  // Step 2
    question: (input) => input.question,
    chat_history: (input) => input.chat_history || [],
  },
  this.prompt,  // Step 3 - build prompt
  this.llm,     // Step 4 - generate
]);
```

**Without LangChain, the RAG chain would be:**
```javascript
async function ragQuery(question, chatHistory) {
  // 1. Embed query
  const queryEmbedding = await embedText(question);

  // 2. Vector search
  const docs = await chromaCollection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 4
  });

  // 3. Build prompt
  const context = docs.documents[0].join('\n\n---\n\n');
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
  ];

  // 4. Call LLM
  return await callLLM(messages);
}
```

---

## 4. STREAMING: Real-time Token Delivery

### 4.1 What Streaming Really Is

LLMs generate tokens one at a time. Streaming sends each token as it's generated instead of waiting for the complete response.

**Without streaming:**
```
User waits 5 seconds → Gets complete response at once
```

**With streaming:**
```
User sees: "The" → "The pricing" → "The pricing for" → ...
```

**Implementation uses Server-Sent Events (SSE):**
```javascript
// server/utils/helpers.js - SSE setup
export const setupSSEResponse = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
};

export const sendSSEEvent = (res, eventType, data) => {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// server/routes/chat.js:67-77 - Streaming loop
for await (const chunk of stream) {
  accumulated = accumulated ? accumulated.concat(chunk) : chunk;

  const textContent = extractChunkContent(chunk);
  if (textContent) {
    textParts.push(textContent);
    sendSSEEvent(res, 'token', { content: textContent });  // Real-time!
  }
}
```

---

## 5. DOCUMENT INGESTION: Preparing the Knowledge Base

### 5.1 The Pipeline

```
PDF Files → Load → Split into Chunks → Embed → Store in Vector DB
```

```javascript
// server/utils/documentLoader.js:44-73

// 1. Load PDFs
const loader = new PDFLoader(filePath);
const docs = await loader.load();

// 2. Split into chunks (important for retrieval quality)
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,        // Each chunk ~1000 chars
  chunkOverlap: 200,      // 200 char overlap between chunks
  separators: ['\n\n', '\n', '. ', ' ', ''],  // Split priorities
});
const splitDocs = await textSplitter.splitDocuments(allDocs);

// 3. Add metadata
splitDocs.forEach((doc, idx) => {
  doc.metadata = {
    source: doc.metadata.source,
    pageNumber: doc.metadata.loc?.pageNumber || 0,
    chunkId: idx,
  };
});

// 4. Store in vector DB (embeddings computed automatically)
await vectorStore.addDocuments(batch);
```

### 5.2 Why Chunking Matters

- **Too large chunks:** Less precise retrieval, may exceed context limits
- **Too small chunks:** Lose context, fragmented information
- **Overlap:** Ensures context isn't lost at chunk boundaries

---

## 6. SESSION MANAGEMENT: Conversation Memory

```javascript
// server/services/conversationManager.js

class ConversationManager {
  constructor() {
    this.sessions = new Map();  // sessionId → { history, lastAccessed }
    this.sessionTimeout = 30 * 60 * 1000;      // 30 min timeout
    this.maxMessagesPerSession = 10;            // Keep last 10 messages
  }

  async addMessage(sessionId, content, isUser = true) {
    const history = this.getOrCreateSession(sessionId);
    const message = isUser ? new HumanMessage(content) : new AIMessage(content);
    await history.addMessage(message);
    await this.applyMessageWindowing(sessionId);  // Trim old messages
  }
}
```

**Why windowing?**
- LLMs have context limits (tokens)
- Old messages become less relevant
- Reduces API costs

---

## 7. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  POST /api/chat { message, sessionId }                            │   │
│  │  Receives: SSE stream (token, done)                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────┬────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS SERVER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐                             │
│  │  routes/chat.js │───▶│  RAGService.js  │                             │
│  │  - validate     │    │  - LLM client   │                             │
│  │  - stream SSE   │    │  - embeddings   │                             │
│  └─────────────────┘    │  - RAG chain    │                             │
│           │             └─────────────────┘                             │
│           ▼                     │                                        │
│  ┌─────────────────────────────────────────┐                            │
│  │       conversationManager.js             │                            │
│  │       - In-memory sessions              │                            │
│  │       - Message history                 │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
└────────────────────────────────────────┬────────────────────────────────┘
                                         │
            ┌────────────────────────────┼────────────────────────────┐
            ▼                            ▼                            ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│   DeepSeek API    │      │   OpenAI API      │      │    ChromaDB       │
│   (LLM)           │      │   (Embeddings)    │      │   (Vector Store)  │
│                   │      │                   │      │                   │
│  deepseek-chat    │      │  text-embedding-  │      │  localhost:8000   │
│                   │      │  3-small          │      │                   │
└───────────────────┘      └───────────────────┘      └───────────────────┘
```

---

## 8. TRADEOFFS & ANALYSIS

### 8.1 LangChain Usage

| Aspect | Approach | Pros | Cons |
|--------|----------|------|------|
| LLM abstraction | LangChain ChatDeepSeek | Easy provider swap, clean API | Hidden complexity, debugging harder |
| RAG chain | RunnableSequence | Composable, readable flow | Magic syntax, learning curve |

**Alternative: Direct API calls**
```javascript
// Simpler for learning, more control, but more boilerplate
async function chat(message, history) {
  const context = await searchVectorStore(message);
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {...});
  return response.json();
}
```

### 8.2 In-Memory Sessions

| Aspect | Current | Alternative |
|--------|---------|-------------|
| Storage | In-memory Map | Redis, PostgreSQL |
| Persistence | Lost on restart | Survives restarts |
| Scaling | Single server only | Multi-server capable |
| Complexity | Simple | More infrastructure |

**Recommendation:** For production, use Redis:
```javascript
// Alternative with Redis
import Redis from 'ioredis';
const redis = new Redis();

async function getHistory(sessionId) {
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : [];
}
```

### 8.3 Vector Store (ChromaDB)

| Aspect | ChromaDB | Alternatives |
|--------|----------|--------------|
| Self-hosted | ✓ | Pinecone (cloud), Weaviate, Qdrant |
| Setup | Docker required | Pinecone: zero setup |
| Scale | Limited | Pinecone: managed scaling |
| Cost | Free | Pinecone: pay per query |

### 8.4 Embeddings Strategy

| Current | Alternative |
|---------|-------------|
| OpenAI embeddings | Local embeddings (sentence-transformers) |
| API cost per embed | Free but slower, less accurate |
| Requires internet | Works offline |

### 8.5 Chunking Strategy

| Current (1000/200) | Considerations |
|--------------------|----------------|
| Fixed size | Content-aware chunking (by sections) |
| Simple | Semantic chunking (by meaning) |
| Works generally | May split mid-sentence |

---

## 9. IMPROVEMENT IDEAS

### 9.1 Hybrid Search
Combine vector search with keyword search:
```javascript
// Current: pure vector search
const results = await vectorStore.similaritySearch(query, 4);

// Better: hybrid search
const vectorResults = await vectorStore.similaritySearch(query, 4);
const keywordResults = await fullTextSearch(query);  // BM25
const merged = rerank(vectorResults, keywordResults);
```

### 9.2 Conversation Memory Types
```javascript
// Current: simple window (last 10 messages)

// Better: summary memory
// Summarize old messages instead of dropping them
const oldMessages = history.slice(0, -10);
const summary = await llm.summarize(oldMessages);
const context = [summary, ...history.slice(-10)];
```

### 9.3 Reranking Retrieved Documents
```javascript
// Current: use top-4 by vector similarity
// Better: rerank with cross-encoder
const candidates = await vectorStore.similaritySearch(query, 20);
const reranked = await crossEncoderRerank(query, candidates);
const top4 = reranked.slice(0, 4);
```

### 9.4 Error Handling Improvements
- Add circuit breakers for external APIs
- Implement retry with exponential backoff
- Cache embeddings for repeated queries

---

## 10. KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| `server/services/RAGService.js` | Core RAG orchestration |
| `server/routes/chat.js` | API endpoint, streaming |
| `server/services/conversationManager.js` | Session management |
| `server/utils/documentLoader.js` | PDF ingestion |
| `server/config/chroma.js` | Vector store config |

---

## 11. DEEP DIVE: RAG RETRIEVAL TUNING

### 11.1 Chunking Strategies

**Current: Fixed-size recursive splitting**
```javascript
// server/utils/documentLoader.js:57-61
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,        // Target size
  chunkOverlap: 200,      // Overlap for context preservation
  separators: ['\n\n', '\n', '. ', ' ', ''],  // Try these in order
});
```

**How it works:**
1. Try to split on `\n\n` (paragraphs)
2. If chunks still too big, split on `\n` (lines)
3. Then `. ` (sentences)
4. Then ` ` (words)
5. Finally `''` (characters)

**Problems:**
- May split mid-thought if paragraph > 1000 chars
- Overlap can duplicate information
- Doesn't understand document structure

**Alternative: Semantic Chunking**
```javascript
// Split based on semantic meaning, not character count
import { SemanticChunker } from 'langchain/text_splitter';

const chunker = new SemanticChunker(embeddings, {
  breakpointThresholdType: 'percentile',
  breakpointThresholdAmount: 95,
});
// Chunks where embedding similarity drops significantly
```

**Alternative: Document-aware Chunking**
```javascript
// For structured documents (headers, sections)
const chunks = [];
let currentChunk = { title: '', content: '' };

for (const line of lines) {
  if (line.startsWith('#')) {  // New section
    if (currentChunk.content) chunks.push(currentChunk);
    currentChunk = { title: line, content: '' };
  } else {
    currentChunk.content += line + '\n';
  }
}
```

### 11.2 Retrieval Strategies

**Current: Simple similarity search (k=4)**
```javascript
// server/services/RAGService.js:84
const retriever = this.vectorStore.asRetriever({
  k: 4,                    // Return 4 most similar
  searchType: 'similarity' // Cosine similarity
});
```

**Problem:** Similarity != Relevance
- "What are the document's conclusions?"
- May retrieve: "The document's conclusion section was added in revision 3..." (similar but not answering)

**Alternative 1: MMR (Maximum Marginal Relevance)**
```javascript
// Balances relevance with diversity
const retriever = vectorStore.asRetriever({
  k: 4,
  searchType: 'mmr',
  searchKwargs: {
    fetchK: 20,        // Fetch 20 candidates
    lambda: 0.5,       // Balance: 0=diversity, 1=similarity
  }
});
```

**Alternative 2: Hybrid Search (Vector + BM25)**
```javascript
// Combine semantic similarity with keyword matching
async function hybridSearch(query, k = 4) {
  // Vector search (semantic)
  const vectorResults = await vectorStore.similaritySearch(query, k * 2);

  // BM25 search (keyword) - would need separate index
  const bm25Results = await bm25Index.search(query, k * 2);

  // Reciprocal Rank Fusion
  const scores = new Map();
  vectorResults.forEach((doc, i) => {
    scores.set(doc.id, (scores.get(doc.id) || 0) + 1 / (i + 60));
  });
  bm25Results.forEach((doc, i) => {
    scores.set(doc.id, (scores.get(doc.id) || 0) + 1 / (i + 60));
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => getDoc(id));
}
```

**Alternative 3: Reranking with Cross-Encoder**
```javascript
// Step 1: Get many candidates (cheap)
const candidates = await vectorStore.similaritySearch(query, 20);

// Step 2: Rerank with cross-encoder (expensive but accurate)
const reranked = await crossEncoder.rerank(query, candidates);

// Step 3: Take top results
return reranked.slice(0, 4);
```

### 11.3 Query Transformation

**Problem:** User queries often aren't optimal for retrieval
- "What did it say?" → Doesn't mention "conclusion" or "findings"
- "That part you mentioned" → Needs context

**Solution: Query Expansion**
```javascript
async function expandQuery(originalQuery, chatHistory) {
  const prompt = `Given this conversation and user query,
                  generate a search query optimized for retrieval.

                  Conversation: ${chatHistory}
                  User query: ${originalQuery}

                  Optimized search query:`;

  const expandedQuery = await llm.invoke(prompt);
  return expandedQuery;
}
```

**Solution: HyDE (Hypothetical Document Embeddings)**
```javascript
// Generate what an ideal answer might look like, embed that
async function hydeSearch(query) {
  const hypotheticalAnswer = await llm.invoke(
    `Write a paragraph that would answer: ${query}`
  );

  // Search using the hypothetical answer embedding
  return await vectorStore.similaritySearch(hypotheticalAnswer, 4);
}
```

### 11.4 Context Window Management

**Current:** Just concatenate all retrieved docs
```javascript
// server/services/RAGService.js:96-98
return docs
  .map((doc, idx) => `[Document ${idx + 1}]\n${doc.pageContent}`)
  .join('\n\n---\n\n');
```

**Problem:** May overflow context window or include irrelevant info

**Solution: Compression**
```javascript
async function compressContext(docs, query) {
  // Extract only relevant sentences from each doc
  const compressedDocs = await Promise.all(docs.map(async (doc) => {
    const sentences = doc.pageContent.split('. ');
    const relevant = sentences.filter(s =>
      // Basic relevance check - could use embeddings
      query.split(' ').some(word => s.toLowerCase().includes(word.toLowerCase()))
    );
    return relevant.join('. ');
  }));

  return compressedDocs.filter(d => d.length > 0);
}
```

### 11.5 Metadata Filtering

**Current:** No filtering - search all documents

```javascript
// Alternative: Pre-filter by metadata
const retriever = vectorStore.asRetriever({
  k: 4,
  filter: {
    source: { $contains: 'pricing' },  // Only pricing docs
    // or
    pageNumber: { $lt: 10 },  // First 10 pages only
  }
});
```

---

## 12. DEEP DIVE: STREAMING IMPLEMENTATION

### 12.1 SSE Protocol Basics

Server-Sent Events is a simple text protocol:

```
event: token
data: {"type":"token","content":"Hello"}

event: token
data: {"type":"token","content":" world"}

event: done
data: {"type":"done"}
```

**Key rules:**
- Each message ends with `\n\n`
- `event:` line is optional (defaults to "message")
- `data:` contains the payload
- Connection stays open until server closes it

**Headers required:**
```javascript
// server/utils/helpers.js:30-35
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');       // Don't buffer!
res.setHeader('Connection', 'keep-alive');        // Don't close
res.setHeader('Access-Control-Allow-Origin', '*'); // CORS
```

### 12.2 Why Not WebSockets?

| SSE | WebSockets |
|-----|------------|
| One-way (server → client) | Bidirectional |
| Auto-reconnect built-in | Manual reconnection |
| Works over HTTP/1.1 | Requires upgrade handshake |
| Simpler for streaming text | Better for real-time games |

For LLM streaming, SSE is simpler and sufficient.

### 12.3 The Streaming Loop Explained

```javascript
// server/routes/chat.js:60-77

// 1. Get async iterator from LangChain
const stream = await ragChain.stream(
  { question: message, chat_history: chatHistory }
);

let accumulated = null;  // Will hold complete message
const textParts = [];    // Collect text for history

// 2. Process each chunk as it arrives
for await (const chunk of stream) {
  // 3. Accumulate - CRITICAL for tool calls
  // AIMessageChunk.concat() merges:
  // - Text content
  // - tool_call_chunks into complete tool_calls
  accumulated = accumulated ? accumulated.concat(chunk) : chunk;

  // 4. Extract and send text immediately
  const textContent = extractChunkContent(chunk);
  if (textContent) {
    textParts.push(textContent);
    sendSSEEvent(res, 'token', { content: textContent });
  }
}

// 5. Stream ended - now process complete tool_calls
if (accumulated?.tool_calls?.length > 0) {
  // Execute tools...
}
```

### 12.4 Chunk Structure from LangChain

```javascript
// Text chunk:
{
  content: "The pricing",
  tool_calls: [],
  tool_call_chunks: []
}

// Tool call chunk (partial):
{
  content: "",
  tool_calls: [],
  tool_call_chunks: [
    {
      index: 0,
      id: "call_xyz",
      name: "some_tool",
      args: '{"title":"Bug' // Incomplete JSON!
    }
  ]
}

// After accumulation - complete:
{
  content: "I'll handle this for you.",
  tool_calls: [
    {
      name: "some_tool",
      args: { title: "Bug report", description: "..." } // Parsed object
    }
  ]
}
```

### 12.5 Error Handling in Streams

```javascript
// Current approach - catch errors, send SSE error event
try {
  for await (const chunk of stream) {
    // ... process
  }
} catch (error) {
  sendSSEEvent(res, 'error', { message: error.message });
  res.end();
}
```

**Problem:** If error occurs mid-stream, client has partial response

**Better: Timeout handling**
```javascript
const TIMEOUT = 30000;

const streamWithTimeout = async function* () {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Stream timeout')), TIMEOUT)
  );

  for await (const chunk of stream) {
    yield await Promise.race([
      Promise.resolve(chunk),
      timeoutPromise
    ]);
  }
};
```

### 12.6 Client-Side Consumption

```javascript
// Client code to consume SSE:
const eventSource = new EventSource('/api/chat');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'token':
      appendToDisplay(data.content);  // Show character by character
      break;
    case 'tool_executing':
      showSpinner(data.tools);
      break;
    case 'tool_result':
      showToolResult(data.tool, data.result);
      break;
    case 'done':
      eventSource.close();
      break;
    case 'error':
      showError(data.message);
      eventSource.close();
      break;
  }
};
```

**Note:** EventSource only supports GET. For POST (like this project), use fetch with streaming:

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  // Parse SSE format: "data: {...}\n\n"
  const lines = text.split('\n\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      handleEvent(data);
    }
  }
}
```

### 12.7 Backpressure Considerations

If client is slow to consume, server buffers grow:

```javascript
// Check if buffer is full
if (res.writableHighWaterMark && res.writableLength > res.writableHighWaterMark) {
  // Pause until drain
  await new Promise(resolve => res.once('drain', resolve));
}

sendSSEEvent(res, 'token', { content: textContent });
```

---

## SUMMARY

This project implements a standard RAG chatbot pattern:

1. **Documents** → Split into chunks → Embed → Store in vector DB
2. **User query** → Embed → Find similar chunks → Build prompt with context → LLM generates
3. **Sessions** → In-memory storage with windowing to manage conversation history

LangChain provides convenience abstractions over raw API calls, but understanding the underlying concepts helps you debug issues and make informed architectural decisions.
