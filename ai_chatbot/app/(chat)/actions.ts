"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import { conversationTitlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatTitleById,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";

const MAX_ASSISTANT_CHARS_FOR_TITLE = 4000;
const MAX_CONVERSATION_CHARS_FOR_TITLE = 8000;

/**
 * Magic number constants for title retry logic
 * Message counts correspond to: user + assistant pairs
 */
const TITLE_RETRY_ATTEMPTS = {
  FIRST: 2, // After first assistant message (first turn complete)
  SECOND: 4, // After second assistant message (second turn complete)
  THIRD: 6, // After third assistant message (third turn complete)
  MAX: 6,
};

function sanitizeGeneratedTitle(raw: string): string {
  // Remove markdown headers, quotes, and extra whitespace
  const title = raw
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .replace(/^Title:\s*/i, "") // Remove "Title:" prefix if present
    .trim();

  // If title is empty or just whitespace, return default
  if (!title || title.trim().length === 0) {
    return "New Conversation";
  }

  // If title is the default fallback from the prompt, keep it
  if (title.toLowerCase() === "new conversation") {
    return "New Conversation";
  }

  return title;
}

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

/**
 * Derives a chat title from the first user turn and the assistant's first reply
 * so the name reflects the topic actually discussed, not only the user's prompt.
 */
export async function generateChatTitleFromTurn({
  userMessage,
  assistantText,
}: {
  userMessage: UIMessage;
  assistantText: string;
}) {
  const userText = getTextFromMessage(userMessage).trim();
  const assistantPreview = assistantText
    .trim()
    .slice(0, MAX_ASSISTANT_CHARS_FOR_TITLE);
  const prompt =
    assistantPreview.length > 0
      ? `User message:\n${userText}\n\nAssistant reply (may be truncated):\n${assistantPreview}`
      : `User message:\n${userText}\n\n(No assistant text yet — infer from the user message only.)`;

  try {
    const { text } = await generateText({
      model: getTitleModel(),
      system: conversationTitlePrompt,
      prompt,
    });
    return sanitizeGeneratedTitle(text);
  } catch (error) {
    console.error(
      "[TITLE] Title generation error:",
      error instanceof Error ? error.message : error
    );
    return "New Conversation";
  }
}

/**
 * Derives a chat title from the full conversation context (multiple turns).
 * Used for retry attempts when the initial title generation returned "New Conversation".
 */
export async function generateChatTitleFromConversation({
  messages,
}: {
  messages: ChatMessage[];
}) {
  // Build conversation context from all messages
  const conversationParts: string[] = [];
  let totalChars = 0;

  for (const msg of messages) {
    const text = getTextFromMessage(msg).trim();
    if (!text) {
      continue;
    }

    const role = msg.role === "user" ? "User" : "Assistant";
    const part = `${role}: ${text}`;

    // Check if adding this part would exceed the limit
    if (totalChars + part.length + 2 > MAX_CONVERSATION_CHARS_FOR_TITLE) {
      // Add truncation notice and stop
      conversationParts.push("\n\n[Conversation truncated for brevity...]");
      break;
    }

    conversationParts.push(part);
    totalChars += part.length + 2; // +2 for newlines
  }

  const conversationText = conversationParts.join("\n\n");

  const prompt = `Based on the following conversation, generate a concise, descriptive chat title (3–6 words) that captures the main topic discussed.

Conversation:
${conversationText}

Rules:
- Output ONLY the title text — no quotes, no hashtags, no "Title:" prefix, no punctuation at the end
- Use title case (capitalise main words)
- Identify the concrete subject discussed
- If the conversation is still too vague or just greetings, output: New Conversation`;

  try {
    const { text } = await generateText({
      model: getTitleModel(),
      system: conversationTitlePrompt,
      prompt,
    });
    return sanitizeGeneratedTitle(text);
  } catch (error) {
    console.error(
      "[TITLE] Title generation error:",
      error instanceof Error ? error.message : error
    );
    return "New Conversation";
  }
}

/**
 * Handles title generation with retry logic for vague conversations.
 *
 * Title retry rules:
 * - First message (2 total): Generate from first turn
 * - Second message (4 total): Retry if title is "New conversation"
 * - Third message (6 total): Final retry if title is "New conversation"
 * - After 3 attempts: Give up and keep "New Conversation"
 */
export async function handleTitleGeneration({
  chatId,
  chat,
  firstUserMessageForTitle,
  uiMessages,
  assistantText,
  dataStream,
}: {
  chatId: string;
  chat: { title: string } | null;
  firstUserMessageForTitle: UIMessage | null;
  uiMessages: ChatMessage[];
  assistantText: string;
  dataStream: {
    write: (part: { type: "data-chat-title"; data: string }) => void;
  };
}): Promise<void> {
  const messageCount = uiMessages.length + 1;

  const isFirstMessage = firstUserMessageForTitle !== null;
  const shouldRetry = chat?.title.toLowerCase() === "new conversation";
  const canRetry =
    messageCount === TITLE_RETRY_ATTEMPTS.SECOND ||
    messageCount === TITLE_RETRY_ATTEMPTS.THIRD;

  // Exit early if no conditions met
  if (!isFirstMessage && !shouldRetry) {
    return;
  }
  if (messageCount > TITLE_RETRY_ATTEMPTS.MAX) {
    return;
  }

  // Determine which generation method to use
  const useFullContext = !isFirstMessage && shouldRetry && canRetry;
  if (!isFirstMessage && !useFullContext) {
    return;
  }

  let title: string;

  try {
    title = isFirstMessage
      ? await generateChatTitleFromTurn({
          userMessage: firstUserMessageForTitle,
          assistantText,
        })
      : await generateChatTitleFromConversation({
          messages: uiMessages,
        });

    // Only update if we got a meaningful title
    if (title && title.toLowerCase() !== "new conversation") {
      dataStream.write({ type: "data-chat-title", data: title });
      await updateChatTitleById({ chatId, title });
      console.log("[TITLE] Generated:", title);
    }
  } catch (error) {
    console.error(
      "[TITLE] Failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisibilityById({ chatId, visibility });
}
