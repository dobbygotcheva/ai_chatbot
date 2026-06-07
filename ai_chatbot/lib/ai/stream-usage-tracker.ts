/**
 * Extract token usage from raw SSE stream before UIMessageStream transformation.
 * Returns both the intercepted stream and a promise that resolves with usage data.
 */

function parseUsageFromLine(line: string): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  const data = line.slice(6);
  if (data === "[DONE]") {
    return null;
  }

  try {
    const parsed = JSON.parse(data);
    if (parsed.usage?.total_tokens) {
      return {
        inputTokens: parsed.usage.prompt_tokens ?? 0,
        outputTokens: parsed.usage.completion_tokens ?? 0,
        totalTokens: parsed.usage.total_tokens ?? 0,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

export function extractUsageFromRawStream(
  rawStream: ReadableStream<Uint8Array>
): {
  interceptedStream: ReadableStream<Uint8Array>;
  usagePromise: Promise<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null>;
} {
  let usageResolver: (
    value: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    } | null
  ) => void;

  const usagePromise = new Promise<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null>((resolve) => {
    usageResolver = resolve;
  });

  const interceptedStream = new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          controller.enqueue(value);

          const chunk = new TextDecoder().decode(value);
          buffer += chunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const usage = parseUsageFromLine(line);
            if (usage) {
              usageResolver(usage);
              return;
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
        usageResolver(null);
      }
    },
  });

  return { interceptedStream, usagePromise };
}
