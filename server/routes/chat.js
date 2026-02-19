import express from 'express';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ragService } from '../services/RAGService.js';
import { conversationManager } from '../services/conversationManager.js';
import {
  validateChatRequest,
  setupSSEResponse,
  sendSSEEvent,
  extractChunkContent,
} from '../utils/helpers.js';
import { executeToolCallsWithSSE } from '../utils/streamProcessor.js';
import { buildToolMessages } from '../services/tools/toolExecutor.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'chat',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Streaming chat endpoint with conversation history.
 */
router.post('/', async (req, res) => {

  const validation = validateChatRequest(req);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }

  const { message, sessionId, context } = validation;
  console.log('📨 Received message:', message);
  console.log('🔑 Session ID:', sessionId);

  if (context) {
    conversationManager.setSessionContext(sessionId, context);
    console.log('📱 Client context stored:', {
      hasUser: !!context.user,
      bookId: context.bookId,
      url: context.currentUrl,
    });
  }

  try {
    setupSSEResponse(res);
    sendSSEEvent(res, 'session', { sessionId });

    const chatHistory = await conversationManager.getMessages(sessionId);
    console.log(`💬 Loaded ${chatHistory.length} messages from history`);

    await conversationManager.addMessage(sessionId, message, true);

    const { ragChain, tools, llm, contextRetriever } = await ragService.getChain();
    console.log('🤖 Starting RAG generation...');

    const stream = await ragChain.stream(
      { question: message, chat_history: chatHistory },
    );

    let accumulated = null;
    const textParts = [];

    for await (const chunk of stream) {
      // Accumulate all chunks - this properly merges tool_call_chunks
      accumulated = accumulated ? accumulated.concat(chunk) : chunk;

      // Stream text tokens to client in real-time
      const textContent = extractChunkContent(chunk);
      if (textContent) {
        textParts.push(textContent);
        sendSSEEvent(res, 'token', { content: textContent });
      }
    }

    // After stream ends, execute complete tool_calls from accumulated message
    const allToolResults = [];
    if (accumulated?.tool_calls?.length > 0) {
      console.log('🔧 Tool calls detected:', accumulated.tool_calls.map(tc => tc.name));
      sendSSEEvent(res, 'tool_executing', {
        tools: accumulated.tool_calls.map((tc) => tc.name),
      });
      const results = await executeToolCallsWithSSE(
        accumulated.tool_calls, tools, res, sessionId
      );
      allToolResults.push(...results);
    }

    let savedResponse;
    if (allToolResults.length > 0) {
      // Synthesis step: call raw LLM with tool results to produce a natural response
      console.log('🔄 Starting synthesis step...');
      const ragContext = await contextRetriever(message);
      const synthesisMessages = [
        new SystemMessage(
          `You are a helpful assistant. Use the tool results and document context below to answer the user's question naturally and completely.\n\nDocument context:\n${ragContext}`
        ),
        ...chatHistory,
        new HumanMessage(message),
        new AIMessage({ content: '', tool_calls: accumulated.tool_calls }),
        ...buildToolMessages(allToolResults, accumulated.tool_calls),
      ];

      const synthesisStream = await llm.stream(synthesisMessages);
      const synthesisParts = [];
      for await (const chunk of synthesisStream) {
        const text = typeof chunk.content === 'string' ? chunk.content : '';
        if (text) {
          synthesisParts.push(text);
          sendSSEEvent(res, 'token', { content: text });
        }
      }
      savedResponse = synthesisParts.join('');
      console.log('✅ Synthesis complete');
    } else {
      savedResponse = textParts.join('');
    }

    await conversationManager.addMessage(sessionId, savedResponse, false);

    sendSSEEvent(res, 'done');
    res.end();

    console.log('✅ Response completed and saved to history');
    console.log(
      `📊 Session ${sessionId} now has ${(await conversationManager.getMessages(sessionId)).length
      } messages`
    );
  } catch (error) {
    console.error('❌ Error in chat endpoint:', error);
    sendSSEEvent(res, 'error', { message: error.message });
    res.end();
  }
});

/**
 * Clear conversation session.
 */
router.delete('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  console.log('🗑️  Request to clear session:', sessionId);

  try {
    await conversationManager.clearSession(sessionId);

    res.json({
      success: true,
      message: `Session ${sessionId} cleared successfully`,
    });
  } catch (error) {
    console.error('❌ Error clearing session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get session information.
 */
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionInfo = await conversationManager.getSessionInfo(sessionId);

    if (!sessionInfo) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      session: sessionInfo,
    });
  } catch (error) {
    console.error('❌ Error getting session info:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
