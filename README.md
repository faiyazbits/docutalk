# Docutalk - AI RAG Chat System

A modern, production-ready **Retrieval-Augmented Generation (RAG)** chat application built with Next.js, Node.js, LangChain.js, DeepSeek AI, and Chroma vector database.

## Features

- **RAG-Powered Responses** - Answers based on your own documents
- **Real-time Streaming** - See AI responses as they're generated
- **Cost-Effective** - Uses DeepSeek API (14x cheaper than GPT-4)
- **Document Ingestion** - Process and store PDF documents
- **Modern UI** - Beautiful Next.js 15 chat interface
- **Vector Search** - Chroma database for semantic search
- **Production Ready** - TypeScript, proper error handling, and logging

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CLIENT (Next.js 15)                        │
│  - Chat UI with streaming support                          │
│  - Server-Sent Events (SSE) handling                       │
│  - Responsive design                                       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/SSE
┌────────────────────▼────────────────────────────────────────┐
│           SERVER (Node.js + Express + LangChain.js)         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  RAG Chain:                                          │  │
│  │  1. Query → Embeddings                               │  │
│  │  2. Vector Search (Chroma)                           │  │
│  │  3. Context + Question → DeepSeek                    │  │
│  │  4. Stream Response                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
┌────────▼────────┐    ┌─────────▼────────┐
│  Chroma DB      │    │  DeepSeek API    │
│  (Docker)       │    │  (Cloud)         │
│  Vector Storage │    │  LLM Generation  │
└─────────────────┘    └──────────────────┘
```

## Project Structure

```
docutalk/
├── client/                 # Next.js 15 frontend
│   ├── src/
│   │   ├── app/            # App router pages
│   │   └── components/     # React components
│   └── package.json
├── server/                 # Node.js backend
│   ├── config/            # Configuration files
│   │   └── chroma.js      # Chroma vector store setup
│   ├── services/          # Business logic
│   │   └── ragChain.js    # RAG chain implementation
│   ├── routes/            # API routes
│   │   └── chat.js        # Chat endpoint
│   ├── utils/             # Utilities
│   │   └── documentLoader.js  # PDF ingestion
│   ├── documents/         # PDF documents (gitignored)
│   ├── .env               # Environment variables
│   └── index.js           # Server entry point
├── SETUP_INSTRUCTIONS.md  # Detailed setup guide
├── pnpm-workspace.yaml    # pnpm workspace config
└── package.json           # Workspace scripts
```

## Quick Start

### Prerequisites

- **Node.js** v18+
- **pnpm** v8+
- **Docker Desktop** (for Chroma)
- **DeepSeek API Key** (get from [platform.deepseek.com](https://platform.deepseek.com))
- **OpenAI API Key** (for embeddings - get from [platform.openai.com](https://platform.openai.com))

### 1. Clone and Install

```bash
# Navigate to project
cd docutalk

# Install dependencies
pnpm install
```

### 2. Start Chroma Database

```bash
# Pull and run Chroma (requires Docker Desktop running)
docker pull chromadb/chroma
docker run -d --name chromadb -p 8000:8000 -v chroma-data:/chroma/chroma chromadb/chroma

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
```

### 3. Configure Environment Variables

```bash
# Edit server/.env and add your API keys
cd server
cp .env.example .env

# Edit .env and replace with your actual keys:
# DEEPSEEK_API_KEY=sk-your-actual-key
# OPENAI_API_KEY=sk-your-actual-key
```

### 4. Ingest Documents (Optional but Recommended)

```bash
# Add PDF files to server/documents/ folder
# Then run ingestion
cd server
pnpm run ingest
```

### 5. Start the Application

```bash
# From root directory - runs both client and server
pnpm run dev
```

**Access the application:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Chroma DB: http://localhost:8000

## Detailed Documentation

See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) for comprehensive setup and configuration guide.

## Available Scripts

### Workspace Commands (run from root)

```bash
# Development
pnpm dev              # Run both client and server
pnpm dev:client       # Run only Next.js client
pnpm dev:server       # Run only Node.js server

# Build
pnpm build:client     # Build Next.js for production
pnpm build:server     # Build server for production

# Server-specific
cd server
pnpm run ingest       # Ingest PDF documents
pnpm run dev          # Run server with auto-reload
pnpm start            # Run server in production mode
```

## API Keys

### DeepSeek API
1. Visit [platform.deepseek.com](https://platform.deepseek.com/)
2. Sign up and navigate to API Keys
3. Create a new key
4. Cost: ~$0.27/M input tokens, $1.10/M output tokens (14x cheaper than GPT-4!)

### OpenAI API (for Embeddings)
1. Visit [platform.openai.com](https://platform.openai.com/api-keys)
2. Create new secret key
3. Cost: ~$0.02/M tokens for text-embedding-3-small

## How to Add Documents

1. **Place PDFs** in `server/documents/` folder
2. **Run ingestion**:
   ```bash
   cd server
   pnpm run ingest
   ```
3. **Start chatting** - The AI will now answer based on your documents!

## Usage Example

```
User: "What is the main topic of these documents?"
AI: "Based on the documents provided, the main topics are..."

User: "Can you summarize the key points?"
AI: "Here are the key points from the documents: 1. ... 2. ..."
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15 | Modern web framework |
| **Backend** | Node.js + Express | API server |
| **AI Framework** | LangChain.js | RAG orchestration |
| **LLM** | DeepSeek API | Text generation |
| **Embeddings** | OpenAI | Text embeddings |
| **Vector DB** | ChromaDB | Document storage & search |
| **Doc Processing** | pdf-parse | PDF parsing |

## Configuration

### Server Environment Variables (`server/.env`)

```bash
# API Keys
DEEPSEEK_API_KEY=sk-your-key
OPENAI_API_KEY=sk-your-key

# Server
PORT=3000
NODE_ENV=development

# Chroma
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=rag-collection
```

## Troubleshooting

### Docker Issues
```bash
# Check if Docker is running
docker ps

# Restart Chroma
docker restart chromadb

# View Chroma logs
docker logs chromadb
```

### API Connection Issues
```bash
# Test server health
curl http://localhost:3000/health

# Check server logs
cd server && pnpm run dev
```

### Build Issues
```bash
# Clear and reinstall
rm -rf node_modules
pnpm install
```

## Performance

- **First Response**: ~2-5 seconds
- **Streaming**: Real-time token-by-token display
- **Document Search**: < 1 second for 4 relevant chunks
- **Cost**: ~$0.001 per typical conversation

## Security Notes

- **API Keys**: Never commit `.env` files
- **CORS**: Configure properly for production
- **Rate Limiting**: Add for production deployments
- **Authentication**: Implement if needed for production

## Deployment

### Server
- Deploy to: Railway, Render, AWS, Google Cloud, Azure
- Set environment variables in platform
- Ensure Chroma is accessible (or use Chroma Cloud)

### Client
- Build: `pnpm build:client`
- Deploy to: Vercel, Netlify, AWS S3, Cloudflare Pages

## License

ISC

## Contributing

Contributions welcome! This is a full-stack RAG implementation showcasing modern AI application architecture.

## Support

For issues or questions:
1. Check [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)
2. Review server logs
3. Ensure all API keys are valid
4. Verify Docker is running

---

**Built with Next.js, LangChain.js, DeepSeek, and Chroma**
