// Chat Repository Port - Core layer
// Defines chat domain database operations
// Infrastructure implements this using Drizzle

import type { Chat, DBMessage, Stream, Vote } from "../../lib/db/schema";

export interface ChatRepositoryPort {
  // Chat operations
  findChatById(id: string): Promise<Chat | null>;
  findChatsByUserId(
    userId: string,
    options?: { includeArchived?: boolean }
  ): Promise<Chat[]>;
  createChat(data: {
    title: string;
    userId: string;
    visibility?: "public" | "private";
  }): Promise<Chat>;
  updateChat(
    id: string,
    data: Partial<Pick<Chat, "title" | "visibility">>
  ): Promise<Chat | null>;
  archiveChat(id: string): Promise<boolean>;
  restoreChat(id: string): Promise<boolean>;
  deleteChat(id: string): Promise<boolean>;

  // Message operations
  findMessageById(id: string): Promise<DBMessage | null>;
  findMessagesByChatId(chatId: string): Promise<DBMessage[]>;
  createMessage(data: {
    chatId: string;
    role: string;
    parts: unknown;
    attachments?: unknown;
  }): Promise<DBMessage>;

  // Vote operations
  findVote(chatId: string, messageId: string): Promise<Vote | null>;
  upsertVote(data: {
    chatId: string;
    messageId: string;
    isUpvoted: boolean;
  }): Promise<Vote>;
  deleteVote(chatId: string, messageId: string): Promise<boolean>;

  // Stream operations
  createStream(data: { chatId: string }): Promise<Stream>;
  findStreamById(id: string): Promise<Stream | null>;
}
