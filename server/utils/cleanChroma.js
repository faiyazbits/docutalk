import { ChromaClient } from 'chromadb';
import 'dotenv/config';

const url = process.env.CHROMA_URL || 'http://localhost:8000';
const collectionName = process.env.CHROMA_COLLECTION || 'rag-collection';

const client = new ChromaClient({ path: url });

try {
  await client.deleteCollection({ name: collectionName });
  console.log(`Deleted Chroma collection: "${collectionName}"`);
} catch (err) {
  if (err.message?.includes('does not exist')) {
    console.log(`Collection "${collectionName}" does not exist — nothing to clean.`);
  } else {
    console.error('Failed to delete collection:', err.message);
    process.exit(1);
  }
}
