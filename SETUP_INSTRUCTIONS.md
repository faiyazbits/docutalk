# Docutalk RAG System - Setup Instructions

## Quick Start

### 1. Start Docker Desktop
Make sure Docker Desktop is running on your machine.

### 2. Start Chroma Vector Database

```bash
# Pull and run Chroma container
docker pull chromadb/chroma
docker run -d --name chromadb -p 8000:8000 -v chroma-data:/chroma/chroma chromadb/chroma

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
```

### 3. Get API Keys

#### DeepSeek API Key
1. Visit: https://platform.deepseek.com/
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Copy the key (format: `sk-...`)

#### OpenAI API Key (for embeddings)
1. Visit: https://platform.openai.com/
2. Sign in or create account
3. Go to: https://platform.openai.com/api-keys
4. Create new secret key
5. Copy the key (format: `sk-...`)

### 4. Configure Environment Variables

Edit `server/.env` and add your API keys:
```bash
DEEPSEEK_API_KEY=sk-your-actual-deepseek-key
OPENAI_API_KEY=sk-your-actual-openai-key
```

### 5. Install Dependencies

```bash
# Install all dependencies (from root)
pnpm install

# Or install separately
cd server && pnpm install
cd ../client && pnpm install
```

### 6. Add Documents

Place your PDF documents in `server/documents/` folder for ingestion.

### 7. Ingest Documents

```bash
cd server
pnpm run ingest
```

### 8. Run the Application

```bash
# From root directory - runs both client and server
pnpm run dev

# Or run separately:
# Terminal 1 (Server)
pnpm run dev:server

# Terminal 2 (Client)
pnpm run dev:client
```

### 9. Access the Application

- **Client (Next.js):** http://localhost:3001
- **Server API:** http://localhost:3000
- **Chroma DB:** http://localhost:8000

## Troubleshooting

### Docker Issues
- Make sure Docker Desktop is running
- Check if port 8000 is available: `lsof -i :8000`
- View Chroma logs: `docker logs chromadb`

### API Connection Issues
- Verify API keys are correctly set in `server/.env`
- Check server logs for error messages
- Test endpoints: `curl http://localhost:3000/health`

### Build Issues
- Clear node_modules: `rm -rf node_modules && pnpm install`

## Development Commands

```bash
# Run both client and server in dev mode
pnpm run dev

# Run only server
pnpm run dev:server

# Run only client
pnpm run dev:client

# Ingest documents
cd server && pnpm run ingest

# Build for production
pnpm run build:client
pnpm run build:server
```

## Next Steps

1. Start Docker and run Chroma container
2. Get your API keys from DeepSeek and OpenAI
3. Update `server/.env` with your keys
4. Add PDF documents to `server/documents/`
5. Run `pnpm run ingest` to process documents
6. Start the application with `pnpm run dev`
7. Open http://localhost:3001 and start chatting!
