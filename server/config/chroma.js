import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';

export const createVectorStore = async (collectionName = null) => {
    const collection = collectionName || process.env.CHROMA_COLLECTION || 'rag-collection';

    console.log(`🔌 Connecting to Chroma at ${process.env.CHROMA_URL}`);
    console.log(`📚 Using collection: ${collection}`);

    const embeddings = new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const vectorStore = new Chroma(embeddings, {
            collectionName: collection,
            url: process.env.CHROMA_URL || 'http://localhost:8000',
        });

        console.log('✅ Chroma vector store connected');
        return vectorStore;
    } catch (error) {
        console.error('❌ Failed to connect to Chroma:', error.message);
        throw error;
    }
};