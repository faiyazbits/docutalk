import { ToolMessage } from '@langchain/core/messages';

/**
 * Build ToolMessage instances from tool results for injection into synthesis messages.
 * @param {Array} toolResults - Results from executeToolCalls/executeToolCallsWithSSE
 * @param {Array} toolCalls - Original tool calls from the accumulated AIMessage (for IDs)
 * @returns {ToolMessage[]}
 */
export const buildToolMessages = (toolResults, toolCalls) => {
  return toolResults.map((result, idx) => {
    const call = toolCalls[idx] || {};
    const content = result.error
      ? `Error: ${result.error}`
      : String(result.result ?? '');
    return new ToolMessage({
      content,
      tool_call_id: call.id ?? `call_${idx}`,
      name: result.name,
    });
  });
};

/**
 * Parse streaming chunks for tool calls.
 * LangChain streams tool calls as special chunks with tool_call_chunks or tool_calls.
 * @param {Object} chunk - Stream chunk from LLM
 * @returns {Array|null} Array of tool calls or null if none
 */
export const parseToolCallChunk = (chunk) => {
  if (chunk.tool_call_chunks?.length > 0) {
    return chunk.tool_call_chunks;
  }
  if (chunk.tool_calls?.length > 0) {
    return chunk.tool_calls;
  }
  return null;
};

/**
 * Execute tool calls from an AIMessage and return results.
 * @param {Object} response - LLM response with potential tool_calls
 * @param {Array} tools - Available tools
 * @returns {Promise<{toolResults: Array, hasToolCalls: boolean}>}
 */
export const executeToolCalls = async (response, tools) => {
  const toolCalls = response.tool_calls || [];

  if (toolCalls.length === 0) {
    return { toolResults: [], hasToolCalls: false };
  }

  const toolResults = await Promise.all(
    toolCalls.map(async (call) => {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        return { name: call.name, error: `Tool '${call.name}' not found` };
      }
      try {
        const result = await tool.invoke(call.args);
        return { name: call.name, args: call.args, result };
      } catch (error) {
        return { name: call.name, args: call.args, error: error.message };
      }
    })
  );

  return { toolResults, hasToolCalls: true };
};
