import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createVectorStore } from '../config/chroma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

export async function ingestDocuments(documentsPath = null, progressCallback = null, fileNames = null) {
  const docsPath = documentsPath || path.join(__dirname, '../documents');

  try {
    console.log('📚 Document Ingestion Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!fs.existsSync(docsPath)) {
      console.log('📁 Creating documents folder...');
      fs.mkdirSync(docsPath, { recursive: true });
    }

    let files;
    if (fileNames && fileNames.length > 0) {
      files = fileNames.map((name) => path.join(docsPath, name));
    } else {
      files = fs
        .readdirSync(docsPath)
        .filter((file) => file.endsWith('.pdf'))
        .map((file) => path.join(docsPath, file));
    }

    if (files.length === 0) {
      console.log('⚠️  No PDF files found in documents folder');
      console.log(`📂 Please add PDF files to: ${path.resolve(docsPath)}`);
      return;
    }

    console.log(`📄 Processing ${files.length} PDF file(s):`);
    files.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${path.basename(file)}`);
    });

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    const vectorStore = await createVectorStore();

    let totalPages = 0;
    let totalChunks = 0;

    for (const filePath of files) {
      const basename = path.basename(filePath);
      console.log(`\n📖 Loading: ${basename}`);

      const loader = new PDFLoader(filePath);
      const docs = await loader.load();
      console.log(`   ✅ Loaded ${docs.length} page(s)`);
      totalPages += docs.length;

      const splitDocs = await textSplitter.splitDocuments(docs);
      console.log(`   ✅ Created ${splitDocs.length} chunks`);

      splitDocs.forEach((doc, idx) => {
        doc.metadata = {
          source: doc.metadata.source || 'unknown',
          pageNumber: doc.metadata.loc?.pageNumber || 0,
          chunkId: idx,
          totalChunks: splitDocs.length,
        };
      });

      progressCallback?.({ type: 'chunks_start', file: basename, total: splitDocs.length });

      const batchSize = 10;
      let successfulChunks = 0;
      let failedChunks = 0;

      for (let i = 0; i < splitDocs.length; i += batchSize) {
        const batch = splitDocs.slice(i, i + batchSize);
        const batchStart = i + 1;
        const batchEnd = Math.min(i + batchSize, splitDocs.length);

        try {
          await vectorStore.addDocuments(batch);
          successfulChunks += batch.length;
          console.log(
            `   ✅ Stored chunks ${batchStart}-${batchEnd} (${successfulChunks}/${splitDocs.length})`
          );
          progressCallback?.({ type: 'batch_stored', file: basename, stored: successfulChunks, total: splitDocs.length });

          if (i + batchSize < splitDocs.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          failedChunks += batch.length;
          console.error(
            `   ❌ Failed to store chunks ${batchStart}-${batchEnd}: ${error.message}`
          );
          console.log('   ⏭️  Continuing with next batch...');
        }
      }

      progressCallback?.({ type: 'file_done', file: basename });
      totalChunks += splitDocs.length;

      if (failedChunks > 0) {
        console.log(`\n⚠️  ${failedChunks} chunks failed to store for ${basename}`);
      }
    }

    console.log('\n✅ Ingestion Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Summary:`);
    console.log(`   Files processed: ${files.length}`);
    console.log(`   Total pages: ${totalPages}`);
    console.log(`   Total chunks: ${totalChunks}`);
    console.log(`   Collection: ${process.env.CHROMA_COLLECTION}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('\n❌ Ingestion Error:', error.message);
    console.error(error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestDocuments()
    .then(() => {
      console.log('\n✅ Done! You can now start the server.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}
