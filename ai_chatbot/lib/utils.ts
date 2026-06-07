import type {
  AssistantModelMessage,
  ChatStatus,
  ToolModelMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = ToolModelMessage | AssistantModelMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

/** True when the assistant message already shows reasoning, tools, or text (hides generic “Thinking…” placeholder). */
export function assistantMessageHasVisibleActivity(
  message: ChatMessage | undefined,
): boolean {
  if (!message?.parts?.length) {
    return false;
  }
  for (const p of message.parts) {
    if (p == null) {
      continue;
    }
    if (p.type === 'text' && 'text' in p) {
      const t = (p as { text: string }).text?.trim();
      if (t) {
        return true;
      }
    }
    if (p.type === 'reasoning') {
      const text =
        'text' in p ? (p as { text: string }).text?.trim() : '';
      const streaming = 'state' in p && p.state === 'streaming';
      if (text || streaming) {
        return true;
      }
    }
    if (p.type === 'dynamic-tool' || p.type.startsWith('tool-')) {
      return true;
    }
  }
  return false;
}

/**
 * While the last assistant message is still a shell (no text/reasoning/tools yet), skip rendering
 * {@link PreviewMessage} so we only show {@link ThinkingMessage} — avoids an empty bubble and a duplicate avatar.
 */
export function shouldHideAssistantStreamingPlaceholder(
  message: ChatMessage,
  status: ChatStatus,
  isLastMessage: boolean,
): boolean {
  return (
    status === 'streaming' &&
    message.role === 'assistant' &&
    isLastMessage &&
    !assistantMessageHasVisibleActivity(message)
  );
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string}).text)
    .join('');
}
