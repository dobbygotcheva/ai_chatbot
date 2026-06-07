import { tool } from "ai";
import { z } from "zod";
import { createArtifact } from "@/lib/db/artifacts";
import { trackToolUsage } from "@/lib/metrics";
import { executeCodeService } from "./execute-code.client";

// Global variables will be set by the chat route
let _userId: string | undefined;
let _chatId: string | undefined;
let _messageId: string | undefined;

// Maximum artifact size: 5MB
const MAX_ARTIFACT_SIZE = 5 * 1024 * 1024;

async function saveImageAsArtifact(image: {
  name: string;
  content_type: string;
  content: string;
}): Promise<string | null> {
  if (!_userId || !_chatId || !_messageId) {
    console.error(
      `[ARTIFACT] Missing required globals — userId=${_userId ? "set" : "missing"}, chatId=${_chatId ? "set" : "missing"}, messageId=${_messageId ? "set" : "missing"}`
    );
    return null;
  }

  const base64Match = image.content.match(/^data:image\/\w+;base64,(.+)$/);
  const base64Data = base64Match
    ? base64Match[1]
    : image.content.replace(/^data:image\/\w+;base64,/, "");
  const size = Math.ceil((base64Data.length * 3) / 4);

  // Check size limit before storing
  if (size > MAX_ARTIFACT_SIZE) {
    console.warn(
      `[ARTIFACT] Skipping ${image.name}: ${size} bytes exceeds ${MAX_ARTIFACT_SIZE} byte limit`
    );
    return null;
  }

  try {
    const artifact = await createArtifact({
      userId: _userId,
      chatId: _chatId,
      messageId: _messageId,
      filename: image.name,
      contentType: image.content_type,
      size,
      data: base64Data,
      kind: "image",
      metadata: {},
    });

    return artifact.id;
  } catch (error) {
    console.error(
      `[ARTIFACT] DB save failed for ${image.name}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export const executeCodeInputSchema = z.object({
  code: z.string().describe("The code to execute"),
  language: z
    .enum(["python", "javascript", "bash"])
    .describe("Programming language"),
  timeout: z
    .number()
    .optional()
    .describe("Execution timeout in milliseconds (default: 30000)"),
});

export function executeCode({
  session,
  chatId,
  messageId,
}: {
  session: { user: { id: string } };
  chatId?: string;
  messageId?: string;
}) {
  _userId = session.user.id;
  _chatId = chatId;
  _messageId = messageId;

  return tool({
    description:
      "Execute Python, JavaScript, or Bash code in a sandboxed Docker environment. Use this for: running calculations, analyzing data, generating plots and visualizations, testing code, or running experiments. When creating matplotlib plots, save them to /tmp/ (e.g., plt.savefig('/tmp/plot.png')) — images are automatically collected and returned as displayable artifacts.",
    inputSchema: executeCodeInputSchema,
    needsApproval: false,
    execute: async ({ code, language, timeout = 30_000 }) => {
      const startTime = performance.now();
      try {
        const result = await executeCodeService({ code, language, timeout });
        const durationMs = Math.round(performance.now() - startTime);

        const imagesWithArtifactIds = await Promise.all(
          (result.images || []).map(async (image) => {
            const artifactId = await saveImageAsArtifact(image);
            if (!artifactId) {
              const missingGlobals = !_userId || !_chatId || !_messageId;
              console.error(
                `[ARTIFACT] Artifact save failed for ${image.name} — ${missingGlobals ? "missing globals" : "DB save failed"}`
              );
              throw new Error(
                "Failed to save generated image as artifact. Plot images must be saved to artifact storage."
              );
            }
            return {
              name: image.name,
              content_type: image.content_type,
              content: artifactId,
              artifactId,
            };
          })
        );

        // Track tool usage
        await trackToolUsage({
          userId: session.user.id,
          toolName: "executeCode",
          toolType: "base",
          chatId: chatId || "unknown",
          messageId,
          success: result.success,
          durationMs,
        });

        return {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.exit_code,
          execution_id: result.execution_id,
          duration_ms: result.duration_ms,
          files: result.files || [],
          images: imagesWithArtifactIds,
        };
      } catch (error) {
        const durationMs = Math.round(performance.now() - startTime);

        // Track failed execution
        await trackToolUsage({
          userId: session.user.id,
          toolName: "executeCode",
          toolType: "base",
          chatId: chatId || "unknown",
          messageId,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          durationMs,
        });

        throw error;
      }
    },
  });
}
