import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.js';
import ingestRoutes from './routes/ingest.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://client:3001', // Docker network (Next.js)
    ],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use('/api/chat', chatRoutes);
app.use('/api/ingest', ingestRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RAG Server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Docutalk RAG API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      chat: '/api/chat',
      chatHealth: '/api/chat/health',
      ingest: '/api/ingest',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log('🚀 RAG Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`📤 Ingest API: http://localhost:${PORT}/api/ingest`);
  console.log(`📊 Chroma: ${process.env.CHROMA_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
