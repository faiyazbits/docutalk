import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ingestDocuments } from '../utils/documentLoader.js';
import { setupSSEResponse, sendSSEEvent } from '../utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const documentsPath = path.join(__dirname, '../documents');

// Ensure documents directory exists
if (!fs.existsSync(documentsPath)) {
  fs.mkdirSync(documentsPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, documentsPath),
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

/**
 * POST /api/ingest
 * Accepts multipart PDF uploads, saves them, then runs ingestion with SSE progress.
 */
router.post('/', upload.array('files', 10), async (req, res) => {
  setupSSEResponse(res);

  const files = req.files;

  if (!files || files.length === 0) {
    sendSSEEvent(res, 'error', { message: 'No files uploaded' });
    res.end();
    return;
  }

  console.log(`📤 Ingest request: ${files.length} file(s)`);
  files.forEach((f) => console.log(`   - ${f.originalname} (${f.size} bytes)`));

  // Notify which files were saved
  for (const file of files) {
    sendSSEEvent(res, 'file_saved', { file: file.originalname });
  }

  const uploadedFileNames = files.map((f) => f.originalname);

  try {
    await ingestDocuments(documentsPath, (event) => {
      sendSSEEvent(res, event.type, event);
    }, uploadedFileNames);

    sendSSEEvent(res, 'done');
    res.end();
    console.log('✅ Ingest complete');
  } catch (error) {
    console.error('❌ Ingest error:', error.message);
    sendSSEEvent(res, 'error', { message: error.message });
    res.end();
  }
});

export default router;
