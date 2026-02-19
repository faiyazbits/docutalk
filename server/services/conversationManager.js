import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * ConversationManager - Manages in-memory chat sessions with automatic cleanup
 *
 * Features:
 * - Session-based conversation history storage
 * - Automatic session timeout (30 minutes)
 * - Message windowing (keeps last 10 messages per session)
 * - Periodic cleanup of inactive sessions
 */
class ConversationManager {
  constructor() {
    // Map of sessionId -> { history: ChatMessageHistory, lastAccessed: timestamp }
    this.sessions = new Map();

    // Session expires after 30 minutes of inactivity
    this.sessionTimeout = 30 * 60 * 1000;

    // Cleanup runs every 5 minutes
    this.cleanupInterval = 5 * 60 * 1000;

    // Keep only last 10 messages (5 exchanges) per session to manage token usage
    this.maxMessagesPerSession = 10;

    // Start automatic cleanup
    this.startCleanup();

    console.log('✅ ConversationManager initialized');
  }

  /**
   * Get or create a session's message history
   * @param {string} sessionId - Unique session identifier
   * @returns {InMemoryChatMessageHistory} The message history for this session
   */
  getOrCreateSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      console.log(`🆕 Creating new session: ${sessionId}`);
      this.sessions.set(sessionId, {
        history: new InMemoryChatMessageHistory(),
        lastAccessed: Date.now(),
        context: null,
      });
    } else {
      this.sessions.get(sessionId).lastAccessed = Date.now();
    }

    return this.sessions.get(sessionId).history;
  }

  /**
   * Set client context for a session (user info, device, URL, etc.)
   * @param {string} sessionId - Session identifier
   * @param {Object} context - Client context object
   */
  setSessionContext(sessionId, context) {
    this.getOrCreateSession(sessionId); // Ensure session exists
    this.sessions.get(sessionId).context = context;
  }

  /**
   * Get client context for a session
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Client context or null if not set
   */
  getSessionContext(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.context : null;
  }

  /**
   * Add a message to a session's history
   * @param {string} sessionId - Session identifier
   * @param {string} content - Message content
   * @param {boolean} isUser - True for user messages, false for AI messages
   */
  async addMessage(sessionId, content, isUser = true) {
    const history = this.getOrCreateSession(sessionId);

    const message = isUser
      ? new HumanMessage(content)
      : new AIMessage(content);

    await history.addMessage(message);

    await this.applyMessageWindowing(sessionId);
  }

  /**
   * Get messages from a session's history
   * @param {string} sessionId - Session identifier
   * @param {number} limit - Maximum number of messages to retrieve (default: all)
   * @returns {Promise<Array>} Array of message objects
   */
  async getMessages(sessionId, limit = null) {
    const history = this.getOrCreateSession(sessionId);
    const messages = await history.getMessages();

    if (limit && messages.length > limit) {
      return messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Apply message windowing to keep session size manageable
   * Keeps only the last N messages to optimize token usage
   * @param {string} sessionId - Session identifier
   */
  async applyMessageWindowing(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const messages = await session.history.getMessages();

    if (messages.length > this.maxMessagesPerSession) {
      const messagesToKeep = messages.slice(-this.maxMessagesPerSession);

      await session.history.clear();
      for (const msg of messagesToKeep) {
        await session.history.addMessage(msg);
      }

      console.log(`🪟 Applied windowing to session ${sessionId}: kept ${messagesToKeep.length} messages`);
    }
  }

  /**
   * Clear a specific session's history
   * @param {string} sessionId - Session identifier
   */
  async clearSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      await session.history.clear();
      this.sessions.delete(sessionId);
      console.log(`🗑️  Cleared session: ${sessionId}`);
    }
  }

  /**
   * Get count of active sessions
   * @returns {number} Number of active sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Get session information for debugging
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session info or null if not found
   */
  async getSessionInfo(sessionId) {
    if (!this.sessions.has(sessionId)) return null;

    const session = this.sessions.get(sessionId);
    const messages = await session.history.getMessages();

    return {
      sessionId,
      messageCount: messages.length,
      lastAccessed: new Date(session.lastAccessed).toISOString(),
      ageMinutes: Math.floor((Date.now() - session.lastAccessed) / 60000),
    };
  }

  /**
   * Start periodic cleanup of inactive sessions
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [sessionId, session] of this.sessions.entries()) {
        const inactiveTime = now - session.lastAccessed;

        if (inactiveTime > this.sessionTimeout) {
          this.sessions.delete(sessionId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} inactive session(s). Active sessions: ${this.sessions.size}`);
      }
    }, this.cleanupInterval);
  }

  /**
   * Stop the cleanup timer (useful for testing or shutdown)
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      console.log('🛑 ConversationManager cleanup stopped');
    }
  }
}

export const conversationManager = new ConversationManager();
