import { trackToolUsage } from "../metrics";

interface ToolExecutionConfig {
  userId: string;
  toolName: string;
  toolType: "base" | "mcp";
  chatId?: string;
  messageId?: string;
}

export function wrapToolExecution<T extends Record<string, unknown>, R>(
  config: ToolExecutionConfig,
  executeFn: (input: T) => Promise<R>
) {
  return async (input: T): Promise<R> => {
    const startTime = performance.now();

    try {
      const result = await executeFn(input);
      const durationMs = Math.round(performance.now() - startTime);

      await trackToolUsage({
        userId: config.userId,
        toolName: config.toolName,
        toolType: config.toolType,
        chatId: config.chatId,
        messageId: config.messageId,
        success: true,
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await trackToolUsage({
        userId: config.userId,
        toolName: config.toolName,
        toolType: config.toolType,
        chatId: config.chatId,
        messageId: config.messageId,
        success: false,
        errorMessage,
        durationMs,
      });

      throw error;
    }
  };
}
