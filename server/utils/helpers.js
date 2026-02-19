import { v4 as uuidv4 } from 'uuid';

/**
 * Validate incoming chat request.
 * @param {Object} req - Express request object
 * @returns {{ isValid: boolean, error?: string, message?: string, sessionId: string, context?: Object }}
 */
export const validateChatRequest = (req) => {
  const { message, sessionId: clientSessionId, context } = req.body;

  if (!message || typeof message !== 'string') {
    return {
      isValid: false,
      error: 'Message is required and must be a string',
    };
  }

  return {
    isValid: true,
    message,
    sessionId: clientSessionId || uuidv4(),
    context: context || null,
  };
};

/**
 * Configure response for Server-Sent Events.
 * @param {Object} res - Express response object
 */
export const setupSSEResponse = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
};

/**
 * Send a typed SSE event.
 * @param {Object} res - Express response object
 * @param {string} type - Event type
 * @param {Object} data - Additional data to include
 */
export const sendSSEEvent = (res, type, data = {}) => {
  const payload = JSON.stringify({ type, ...data });
  res.write(`data: ${payload}\n\n`);
};

/**
 * Extract text content from various chunk formats.
 * @param {string|Object} chunk - Stream chunk (string or AIMessageChunk)
 * @returns {string} Extracted text content
 */
export const extractChunkContent = (chunk) => {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (chunk?.content) {
    return chunk.content;
  }
  return '';
};
