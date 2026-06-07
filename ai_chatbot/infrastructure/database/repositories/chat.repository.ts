// Chat Repository Implementation - Infrastructure layer
// Implements ChatRepositoryPort using Drizzle ORM

import { and, eq, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ChatRepositoryPort } from "../../../core/chat/chat.repository.port";
import type * as schema from "../../../lib/db/schema";
import {
  type Chat,
  chat,
  type DBMessage,
  message,
  type Stream,
  stream,
  type Vote,
  vote,
} from "../../../lib/db/schema";

export class ChatRepository implements ChatRepositoryPort {
  private readonly db: PostgresJsDatabase<typeof schema>;

  constructor(db: PostgresJsDatabase<typeof schema>) {
    this.db = db;
  }

  // Chat operations
  async findChatById(id: string): Promise<Chat | null> {
    const result = await this.db
      .select()
      .from(chat)
      .where(eq(chat.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findChatsByUserId(
    userId: string,
    options?: { includeArchived?: boolean }
  ): Promise<Chat[]> {
    const conditions = [eq(chat.userId, userId)];
    if (!options?.includeArchived) {
      conditions.push(isNull(chat.archivedAt));
    }
    const result = await this.db
      .select()
      .from(chat)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);
    return result;
  }

  async createChat(data: {
    title: string;
    userId: string;
    visibility?: "public" | "private";
  }): Promise<Chat> {
    const result = await this.db
      .insert(chat)
      .values({
        title: data.title,
        userId: data.userId,
        visibility: data.visibility ?? "private",
        createdAt: new Date(),
      } as typeof chat.$inferInsert)
      .returning();
    if (!result[0]) {
      throw new Error("Failed to create chat");
    }
    return result[0];
  }

  async updateChat(
    id: string,
    data: Partial<Pick<Chat, "title" | "visibility">>
  ): Promise<Chat | null> {
    const result = await this.db
      .update(chat)
      .set(data)
      .where(eq(chat.id, id))
      .returning();
    return result[0] ?? null;
  }

  async archiveChat(id: string): Promise<boolean> {
    const result = await this.db
      .update(chat)
      .set({ archivedAt: new Date() } as Partial<typeof chat.$inferSelect>)
      .where(eq(chat.id, id))
      .returning();
    return result.length > 0;
  }

  async restoreChat(id: string): Promise<boolean> {
    const result = await this.db
      .update(chat)
      .set({ archivedAt: null } as Partial<typeof chat.$inferSelect>)
      .where(eq(chat.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteChat(id: string): Promise<boolean> {
    const result = await this.db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return result.length > 0;
  }

  // Message operations
  async findMessageById(id: string): Promise<DBMessage | null> {
    const result = await this.db
      .select()
      .from(message)
      .where(eq(message.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findMessagesByChatId(chatId: string): Promise<DBMessage[]> {
    const result = await this.db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId));
    return result;
  }

  async createMessage(data: {
    chatId: string;
    role: string;
    parts: unknown;
    attachments?: unknown;
  }): Promise<DBMessage> {
    const result = await this.db
      .insert(message)
      .values({
        ...data,
        attachments: data.attachments ?? [],
        createdAt: new Date(),
      })
      .returning();
    if (!result[0]) {
      throw new Error("Failed to create message");
    }
    return result[0];
  }

  // Vote operations
  async findVote(chatId: string, messageId: string): Promise<Vote | null> {
    const result = await this.db
      .select()
      .from(vote)
      .where(and(eq(vote.chatId, chatId), eq(vote.messageId, messageId)))
      .limit(1);
    return result[0] ?? null;
  }

  async upsertVote(data: {
    chatId: string;
    messageId: string;
    isUpvoted: boolean;
  }): Promise<Vote> {
    const result = await this.db
      .insert(vote)
      .values(data)
      .onConflictDoUpdate({
        target: [vote.chatId, vote.messageId],
        set: { isUpvoted: data.isUpvoted },
      })
      .returning();
    if (!result[0]) {
      throw new Error("Failed to upsert vote");
    }
    return result[0];
  }

  async deleteVote(chatId: string, messageId: string): Promise<boolean> {
    const result = await this.db
      .delete(vote)
      .where(and(eq(vote.chatId, chatId), eq(vote.messageId, messageId)))
      .returning();
    return result.length > 0;
  }

  // Stream operations
  async createStream(data: { chatId: string }): Promise<Stream> {
    const result = await this.db
      .insert(stream)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .returning();
    if (!result[0]) {
      throw new Error("Failed to create stream");
    }
    return result[0];
  }

  async findStreamById(id: string): Promise<Stream | null> {
    const result = await this.db
      .select()
      .from(stream)
      .where(eq(stream.id, id))
      .limit(1);
    return result[0] ?? null;
  }
}
