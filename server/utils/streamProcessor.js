import { sendSSEEvent } from './helpers.js';
import { conversationManager } from '../services/conversationManager.js';

/**
 * Execute tool calls and stream results via SSE.
 * @param {Array} toolCalls - Array of tool call objects (from accumulated.tool_calls)
 * @param {Array} tools - Available tools
 * @param {Object} res - Express response object
 * @param {string} sessionId - Session ID to fetch client context
 * @returns {Promise<Array>} Array of tool results
 */
export const executeToolCallsWithSSE = async (toolCalls, tools, res, sessionId) => {
  const results = [];

  const clientContext = conversationManager.getSessionContext(sessionId);

  for (const toolCall of toolCalls) {
    console.log(`⚙️  Executing tool: ${toolCall.name}`);

    const tool = tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      console.error(`❌ Tool not found: ${toolCall.name}`);
      sendSSEEvent(res, 'tool_error', {
        tool: toolCall.name,
        error: `Tool '${toolCall.name}' not found`,
      });
      continue;
    }

    try {
      const argsWithContext = {
        ...toolCall.args,
        _clientContext: clientContext,
      };
      const toolResult = await tool.invoke(argsWithContext);
      console.log(`✅ Tool result:`, toolResult);

      sendSSEEvent(res, 'tool_result', {
        tool: toolCall.name,
        result: toolResult,
      });

      results.push({
        name: toolCall.name,
        result: toolResult,
      });
    } catch (error) {
      console.error(`❌ Error executing tool ${toolCall.name}:`, error);
      sendSSEEvent(res, 'tool_error', {
        tool: toolCall.name,
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Build full response string from accumulated results.
 * @param {Array<string>} textParts - Array of text chunks
 * @param {Array} toolResults - Array of tool result objects
 * @returns {string} Combined response string
 */
export const buildFullResponse = (textParts, toolResults) => {
  let response = textParts.join('');

  for (const { name, result } of toolResults) {
    response += `\n\n[Tool: ${name}]\n${result}\n`;
  }

  return response;
};
