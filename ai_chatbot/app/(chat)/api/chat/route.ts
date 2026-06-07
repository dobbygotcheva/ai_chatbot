import { geolocation } from "@vercel/functions";
import type {
  LanguageModelUsage,
  ModelMessage,
  UIMessage,
  UIMessagePart,
} from "ai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  MessageConversionError,
  stepCountIs,
  streamText,
} from "ai";
import { cookies } from "next/headers";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { filterBase64FromToolResults } from "@/lib/ai/filter-base64-from-llm";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { crawlPages } from "@/lib/ai/tools/crawl-pages";
import { createDocument } from "@/lib/ai/tools/create-document";
import { executeCode } from "@/lib/ai/tools/execute-code";
import { findWebpages } from "@/lib/ai/tools/find-webpages";
import { getCurrentDate } from "@/lib/ai/tools/get-current-date";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { hasPermission } from "@/lib/auth/permission-utils";
import { CONTEXT_WINDOW_INPUT, isProductionEnvironment } from "@/lib/constants";
import { estimateContextUsageFromMessages } from "@/lib/context-usage";
import {
  archiveChatById,
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  unarchiveChatById,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { createMcpTools, hasAtlassianMcpConnected } from "@/lib/mcp/tools";
import { trackTokenUsage, trackToolUsage } from "@/lib/metrics";
import {
  DEFAULT_PERSONALITY,
  PERSONALITY_COOKIE,
  PERSONALITY_OPTIONS,
  type Personality,
} from "@/lib/personality";
import type {
  ChatMessage,
  ChatTools,
  CustomUIDataTypes,
  MessageMetadata,
} from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { config } from "@/shared/config";
import { handleTitleGeneration } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

/**
 * Extract token usage from AI SDK result, with fallback to raw provider data
 */
function extractTokenUsage(usage: LanguageModelUsage): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  // Try standard fields first
  let inputTokens = Number(usage.inputTokens ?? 0);
  let outputTokens = Number(usage.outputTokens ?? 0);
  let totalTokens = Number(usage.totalTokens ?? 0);

  // Fallback: extract from raw provider response
  if (
    (inputTokens === 0 || Number.isNaN(inputTokens)) &&
    (outputTokens === 0 || Number.isNaN(outputTokens)) &&
    usage.raw
  ) {
    const raw = usage.raw as Record<string, unknown>;
    console.log("[METRICS] Raw usage data:", JSON.stringify(raw, null, 2));

    inputTokens = Number(
      (raw.prompt_tokens as number) ?? (raw.input_tokens as number) ?? 0
    );
    outputTokens = Number(
      (raw.completion_tokens as number) ?? (raw.output_tokens as number) ?? 0
    );
    totalTokens =
      Number(raw.total_tokens as number) || inputTokens + outputTokens;
  }

  // Final fallback: calculate from details
  if (
    totalTokens === 0 &&
    usage.inputTokenDetails &&
    usage.outputTokenDetails
  ) {
    const inputDetails = usage.inputTokenDetails;
    const outputDetails = usage.outputTokenDetails;

    inputTokens =
      (inputDetails.noCacheTokens ?? 0) +
      (inputDetails.cacheReadTokens ?? 0) +
      (inputDetails.cacheWriteTokens ?? 0);

    outputTokens =
      (outputDetails.textTokens ?? 0) + (outputDetails.reasoningTokens ?? 0);

    totalTokens = inputTokens + outputTokens;
  }

  return { inputTokens, outputTokens, totalTokens };
}

type ContextUsageChunk = {
  type: "data-contextUsage";
  data: CustomUIDataTypes["contextUsage"];
  id?: string;
  transient?: boolean;
};

type ContextUsageWriter = {
  write: (part: ContextUsageChunk) => void;
};

function calculateContextPercentage(
  inputTokens: number,
  contextWindowSize: number
): number {
  return Math.min(100, Math.round((inputTokens / contextWindowSize) * 100));
}

async function emitFinalContextUsageAndMetrics(params: {
  dataStream: ContextUsageWriter;
  usagePromise: PromiseLike<LanguageModelUsage>;
  estimatedInputTokens: number;
  contextWindowSize: number;
  userId: string;
  chatId: string;
  modelId: string;
}) {
  try {
    const usage = await params.usagePromise;
    const tokens = extractTokenUsage(usage);

    const inputTokensForContext =
      tokens.inputTokens > 0 ? tokens.inputTokens : params.estimatedInputTokens;

    const outputTokensForContext =
      tokens.outputTokens > 0 ? tokens.outputTokens : 0;

    const totalTokensForContext =
      tokens.totalTokens > 0
        ? tokens.totalTokens
        : inputTokensForContext + outputTokensForContext;

    const contextPercentage = calculateContextPercentage(
      inputTokensForContext,
      params.contextWindowSize
    );

    params.dataStream.write({
      type: "data-contextUsage",
      data: {
        inputTokens: inputTokensForContext,
        outputTokens: outputTokensForContext,
        totalTokens: totalTokensForContext,
        contextPercentage,
      },
    });

    if (tokens.totalTokens > 0) {
      await trackTokenUsage({
        userId: params.userId,
        chatId: params.chatId,
        modelId: params.modelId,
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        totalTokens: tokens.totalTokens,
      });
    }
  } catch (err) {
    console.error("[METRICS] Failed to track token usage/context:", err);

    const contextPercentage = calculateContextPercentage(
      params.estimatedInputTokens,
      params.contextWindowSize
    );

    params.dataStream.write({
      type: "data-contextUsage",
      data: {
        inputTokens: params.estimatedInputTokens,
        outputTokens: 0,
        totalTokens: params.estimatedInputTokens,
        contextPercentage,
      },
    });
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Should be refactored later, split into multiple functions.
export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    const parsed = postRequestBodySchema.safeParse(json);
    if (!parsed.success) {
      console.error("[chat API] Invalid request body:", parsed.error.flatten());
      return new ChatSDKError("bad_request:api").toResponse();
    }
    requestBody = parsed.data;
  } catch (error) {
    console.error("[chat API] Failed to read JSON body:", error);
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const scenarioInstruction: string | null = null;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType = "regular" as const;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Array.isArray(messages) && messages.length > 0;

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let firstUserMessageForTitle: UIMessage<
      MessageMetadata,
      CustomUIDataTypes,
      ChatTools
    > | null = null;

    console.log(
      "[TITLE] Chat exists:",
      !!chat,
      "Chat title:",
      chat?.title,
      "Message role:",
      message?.role
    );

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New conversation",
        visibility: selectedVisibilityType,
      });
      console.log("[TITLE] New chat created, setting up title generation");
      // Transform validated message to UIMessage format (used for topic-based title after first reply)
      firstUserMessageForTitle = {
        id: message.id ?? generateId(),
        role: "user" as const,
        // Transform parts to ensure proper type structure
        parts: message.parts.map((part) => {
          if ("text" in part && typeof part.text === "string") {
            return { type: "text" as const, text: part.text };
          }
          if ("url" in part && typeof part.url === "string") {
            return {
              type: "file" as const,
              mediaType: part.mediaType as "image/png" | "image/jpeg",
              url: part.url,
              name: part.name ?? "unknown",
            };
          }
          // Fallback for any other part type
          return part as UIMessagePart<CustomUIDataTypes, ChatTools>;
        }),
      };
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    if (!isToolApprovalFlow && message == null) {
      return new ChatSDKError(
        "bad_request:api",
        "Either message or non-empty messages is required"
      ).toResponse();
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id ?? generateId(),
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    // ── Resolve personality from cookie ────────────────────────────────────
    // The personality preference is stored as a plain string cookie set by
    // the Settings page.  We validate it against the allow-list before use so
    // that a manually crafted or stale cookie value can never inject arbitrary
    // text into the system prompt.  Invalid or missing values fall back to the
    // default personality silently, preserving a good UX with no error state.
    const cookieStore = await cookies();
    const rawPersonality = cookieStore.get(PERSONALITY_COOKIE)?.value;
    const validPersonalities = PERSONALITY_OPTIONS.map((opt) => opt.value);
    const personality: Personality =
      rawPersonality &&
      validPersonalities.includes(rawPersonality as Personality)
        ? (rawPersonality as Personality)
        : DEFAULT_PERSONALITY;

    let modelMessages: ModelMessage[];
    try {
      const filteredMessages = filterBase64FromToolResults(uiMessages);
      modelMessages = await convertToModelMessages(filteredMessages);
    } catch (error) {
      if (MessageConversionError.isInstance(error)) {
        console.error("[chat API] convertToModelMessages:", error.message);
        return new ChatSDKError("bad_request:api", error.message).toResponse();
      }
      throw error;
    }

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        console.log(
          "[CHAT] Starting stream execution for userId:",
          session.user.id
        );

        // Check if user has Atlassian MCP connected
        const hasAtlassianMcp = await hasAtlassianMcpConnected(session.user.id);
        console.log("[CHAT] hasAtlassianMcp:", hasAtlassianMcp);

        // Build the active tools list dynamically
        const baseTools = [
          "findWebpages",
          "crawlPages",
          "getWeather",
          "getCurrentDate",
          "createDocument",
          "updateDocument",
          "requestSuggestions",
          "executeCode",
        ];

        // Build the base tools object with tracking
        // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool types are complex
        const tools: Record<string, any> = {
          findWebpages: {
            ...findWebpages,
            execute: async (input: unknown) => {
              const startTime = performance.now();
              try {
                const result = await (
                  findWebpages.execute as (input: unknown) => Promise<unknown>
                )(input);
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "findWebpages",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: true,
                  durationMs,
                });
                return result;
              } catch (error) {
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "findWebpages",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: false,
                  errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                  durationMs,
                });
                throw error;
              }
            },
          },
          crawlPages: {
            ...crawlPages,
            execute: async (input: unknown) => {
              const startTime = performance.now();
              try {
                const result = await (
                  crawlPages.execute as (input: unknown) => Promise<unknown>
                )(input);
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "crawlPages",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: true,
                  durationMs,
                });
                return result;
              } catch (error) {
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "crawlPages",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: false,
                  errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                  durationMs,
                });
                throw error;
              }
            },
          },
          getWeather: {
            ...getWeather,
            execute: async (input: unknown) => {
              const startTime = performance.now();
              try {
                const result = await (
                  getWeather.execute as (input: unknown) => Promise<unknown>
                )(input);
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "getWeather",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: true,
                  durationMs,
                });
                return result;
              } catch (error) {
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "getWeather",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: false,
                  errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                  durationMs,
                });
                throw error;
              }
            },
          },
          getCurrentDate: {
            ...getCurrentDate,
            execute: async (input: unknown) => {
              const startTime = performance.now();
              try {
                const result = await (
                  getCurrentDate.execute as (input: unknown) => Promise<unknown>
                )(input);
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "getCurrentDate",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: true,
                  durationMs,
                });
                return result;
              } catch (error) {
                const durationMs = Math.round(performance.now() - startTime);
                await trackToolUsage({
                  userId: session.user.id,
                  toolName: "getCurrentDate",
                  toolType: "base",
                  chatId: id,
                  messageId: message?.id,
                  success: false,
                  errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                  durationMs,
                });
                throw error;
              }
            },
          },
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({ session, dataStream }),
          executeCode: executeCode({
            session,
            chatId: id,
            messageId: message?.id,
          }),
        };

        // Add MCP tools dynamically if connected
        // Token-aware filtering is built into createMcpTools - only tools for services with tokens are included
        let activeTools = baseTools;
        if (hasAtlassianMcp) {
          console.log("[CHAT] Fetching MCP tools...");
          // Fetch tools from MCP server and create dynamic wrappers
          // Token filtering is automatic - only Jira tools if only Jira token, only Confluence if only Confluence token
          const mcpTools = await createMcpTools({
            userId: session.user.id,
            descriptionPrefix: "Call the Atlassian MCP tool.",
          });
          console.log("[CHAT] MCP tools created:", Object.keys(mcpTools));
          Object.assign(tools, mcpTools);

          // Add the dynamically created tool names to activeTools
          activeTools = [...baseTools, ...Object.keys(mcpTools)];
        }

        console.log("[CHAT] Final active tools:", activeTools);
        console.log(
          "[CHAT] Total tools object keys:",
          Object.keys(tools).length
        );

        console.log("[LLM] Calling streamText with model:", selectedChatModel);
        const llmStartTime = Date.now();

        const hasToolsPermission = hasPermission(session, "tools");

        const result = streamText({
          model: getLanguageModel(selectedChatModel),
          system: systemPrompt({
            selectedChatModel,
            requestHints,
            personality,
            scenarioInstruction,
            hasToolsPermission,
          }),
          messages: modelMessages,
          stopWhen: stepCountIs(10),
          experimental_activeTools: isReasoningModel ? [] : activeTools,
          providerOptions: {
            ...(isReasoningModel && {
              anthropic: {
                thinking: { type: "enabled", budgetTokens: 10_000 },
              },
            }),
            openai: {
              streamOptions: {
                includeUsage: true,
              },
            },
          },
          tools,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment(),
            functionId: "stream-text",
          },
          abortSignal: request.signal,
        });

        console.log(
          "[LLM] streamText created, tracking usage via result.usage promise..."
        );

        // Convert to UIMessageStream for the response
        const uiMessageStream = result.toUIMessageStream({
          sendReasoning: true,
          originalMessages: isToolApprovalFlow ? uiMessages : undefined,
        });

        // Emit an early context-usage estimate so the UI can display
        // the chip immediately while the assistant is still streaming.
        // (Final value is emitted again once `result.usage` resolves.)
        const {
          inputTokens: estimatedInputTokens,
          contextPercentage: earlyContextPercentage,
        } = estimateContextUsageFromMessages(uiMessages, -1);

        dataStream.write({
          type: "data-contextUsage",
          data: {
            inputTokens: estimatedInputTokens,
            outputTokens: 0,
            totalTokens: estimatedInputTokens,
            contextPercentage: earlyContextPercentage,
          },
        });

        // Merge the UIMessageStream
        const mergeStartTime = Date.now();
        dataStream.merge(uiMessageStream);
        console.log(
          "[LLM] Stream merged in",
          Date.now() - mergeStartTime,
          "ms"
        );
        console.log(
          "[LLM] Total LLM setup time:",
          Date.now() - llmStartTime,
          "ms"
        );

        const usagePromise = result.usage;

        // Title generation with retry logic (extracted to reduce complexity)
        const assistantText = await result.text;
        await handleTitleGeneration({
          chatId: id,
          chat,
          firstUserMessageForTitle,
          uiMessages: uiMessages as ChatMessage[],
          assistantText,
          dataStream,
        });

        await emitFinalContextUsageAndMetrics({
          dataStream,
          usagePromise,
          estimatedInputTokens,
          contextWindowSize: CONTEXT_WINDOW_INPUT,
          userId: session.user.id,
          chatId: id,
          modelId: selectedChatModel,
        });
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        console.log(
          "[ONFINISH] Called with",
          finishedMessages.length,
          "messages"
        );
        const onFinishStart = Date.now();

        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          console.log(
            "[ONFINISH] Saving",
            finishedMessages.length,
            "messages to DB"
          );
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
          console.log(
            "[ONFINISH] Messages saved in",
            Date.now() - onFinishStart,
            "ms"
          );
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    console.log("[STREAM] Creating UIMessageStreamResponse");
    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        console.log(
          "[STREAM] consumeSseStream called, redis:",
          !!config.redis.url
        );
        if (!config.redis.url) {
          console.log("[STREAM] No Redis URL, skipping resumable stream");
          return;
        }
        try {
          const streamContext = getStreamContext();
          console.log("[STREAM] Stream context:", !!streamContext);
          if (streamContext) {
            const streamId = generateId();
            console.log("[STREAM] Creating resumable stream:", streamId);
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
            console.log("[STREAM] Resumable stream created");
          }
        } catch (err) {
          console.error(
            "[STREAM] Error creating resumable stream:",
            err as Error
          );
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

/**
 * GET /api/chat?id=<chatId>
 * Returns the UI messages for an existing chat, used by the portal page
 * to load a history chat in-place without navigating to /chat/[id].
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (!chat) {
    return Response.json({ messages: [], title: null }, { status: 200 });
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const messagesFromDb = await getMessagesByChatId({ id });
  const uiMessages = convertToUIMessages(messagesFromDb);

  return Response.json(
    { messages: uiMessages, title: chat.title },
    { status: 200 }
  );
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  // Wrap the whole flow so we never leak a raw exception to Next.js, which
  // would surface as the opaque "An error occurred while executing a database
  // query." in dev logs with zero context. We log here with the chatId so a
  // failed delete is debuggable.
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const chat = await getChatById({ id });

    // Treat a missing row as "already gone" — clients get a clean 200 instead
    // of a confusing 403 if they double-click delete or hit a stale list.
    if (!chat) {
      return Response.json({ id, alreadyDeleted: true }, { status: 200 });
    }

    if (chat.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const deletedChat = await deleteChatById({ id });

    return Response.json(deletedChat, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/chat] Failed for chat", id, error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:database",
      error instanceof Error ? error.message : "Unknown delete failure"
    ).toResponse();
  }
}

/**
 * PATCH /api/chat?id=<chatId>
 * Body: { action: "archive" | "unarchive" }
 *     | { action: "rename"; title: string }
 *
 * Single-chat mutation endpoint used by:
 *   - The "Archive" option in the sidebar chat context menu
 *   - The "Restore" button inside the archived-chats dialog in Settings
 *   - The inline "Rename" button on each row of the /history page
 *
 * We reuse the existing /api/chat route (rather than a separate /api/archive
 * or /api/rename) to keep all per-chat mutations in one place alongside POST
 * and DELETE. Ownership is verified before any mutation to prevent
 * cross-user tampering.
 */
const MAX_CHAT_TITLE_LENGTH = 200;

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  let action: string;
  let title: string | undefined;
  try {
    const body = await request.json();
    action = body.action;
    title = typeof body.title === "string" ? body.title : undefined;
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  // Whitelist check: reject any action we don't know about
  if (action !== "archive" && action !== "unarchive" && action !== "rename") {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  let normalizedTitle: string | undefined;
  if (action === "rename") {
    normalizedTitle = title?.trim();
    if (!normalizedTitle || normalizedTitle.length > MAX_CHAT_TITLE_LENGTH) {
      return new ChatSDKError("bad_request:api").toResponse();
    }
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chatRecord = await getChatById({ id });

  // Ensure the caller owns this chat — same guard used in the DELETE handler
  if (chatRecord?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  if (action === "rename") {
    await updateChatTitleById({
      chatId: id,
      title: normalizedTitle as string,
    });
    return Response.json({ id, title: normalizedTitle }, { status: 200 });
  }

  const result =
    action === "archive"
      ? await archiveChatById({ id })
      : await unarchiveChatById({ id });

  return Response.json(result, { status: 200 });
}
