export const runtime = 'nodejs';

/**
 * Protocol bridge: translates the Express custom SSE format into the
 * Vercel AI SDK Data Stream Protocol that useChat expects.
 *
 * Express SSE event types → AI SDK Data Stream Protocol:
 *   token          → 0:"<text>"\n            (text chunk)
 *   tool_executing → 2:[{...}]\n             (data annotation)
 *   tool_result    → 2:[{...}]\n             (data annotation)
 *   tool_error     → 2:[{...}]\n             (data annotation)
 *   session        → 2:[{...}]\n             (data annotation)
 *   error          → 3:"<message>"\n         (error part)
 *   done           → d:{"finishReason":...}\n (finish)
 */
export async function POST(req: Request) {
  const body = await req.json();

  const message = body.messages?.at(-1)?.content ?? '';
  const { sessionId, context } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: 'No message provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${process.env.BACKEND_API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, context }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reach backend';
    return new Response(`3:${JSON.stringify(msg)}\n`, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  }

  if (!backendRes.ok || !backendRes.body) {
    const msg = `Backend error: ${backendRes.status}`;
    return new Response(`3:${JSON.stringify(msg)}\n`, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = backendRes.body!.getReader();

      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              switch (event.type) {
                case 'token':
                  // AI SDK text part: 0:"<json-encoded text>"\n
                  enqueue(`0:${JSON.stringify(event.content)}\n`);
                  break;
                case 'tool_executing':
                  enqueue(
                    `2:${JSON.stringify([{ type: 'tool_executing', tools: event.tools }])}\n`
                  );
                  break;
                case 'tool_result':
                  enqueue(
                    `2:${JSON.stringify([
                      { type: 'tool_result', tool: event.tool, result: event.result },
                    ])}\n`
                  );
                  break;
                case 'tool_error':
                  enqueue(
                    `2:${JSON.stringify([
                      { type: 'tool_error', tool: event.tool, error: event.error },
                    ])}\n`
                  );
                  break;
                case 'session':
                  enqueue(
                    `2:${JSON.stringify([{ type: 'session', sessionId: event.sessionId }])}\n`
                  );
                  break;
                case 'error':
                  enqueue(`3:${JSON.stringify(event.message ?? 'Unknown error')}\n`);
                  break;
                case 'done':
                  enqueue(
                    `d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`
                  );
                  controller.close();
                  return;
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
        // Stream ended without a 'done' event — close gracefully
        enqueue(
          `d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`
        );
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        enqueue(`3:${JSON.stringify(msg)}\n`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}
