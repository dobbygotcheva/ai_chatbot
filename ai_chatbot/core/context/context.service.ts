// Context Service - Core implementation
// Uses Shared layer ports (VectorSearchPort, DatabasePort)
// NO direct access to Qdrant - only through VectorSearchPort

import type { DatabasePort } from "../../shared/database/database.port";
import type { VectorSearchPort } from "../../shared/vector/vector.port";
import type {
  BuildContextInput,
  ContextBundle,
  ContextPort,
  ConversationContext,
  MessageContext,
  RelevantDocument,
  UserContext,
} from "./context.port";

export class ContextService implements ContextPort {
  readonly vectorSearch: VectorSearchPort;
  readonly database: DatabasePort;

  constructor(vectorSearch: VectorSearchPort, database: DatabasePort) {
    this.vectorSearch = vectorSearch;
    this.database = database;
  }

  async buildContext(input: BuildContextInput): Promise<ContextBundle> {
    // Fetch user from database
    const user = await this.fetchUser(input.userId);

    // Fetch conversation if chatId provided
    const conversation = input.chatId
      ? await this.fetchConversation(input.chatId)
      : null;

    // Fetch relevant documents using vector search (Qdrant via port)
    const relevantDocuments = await this.fetchRelevantDocuments(
      input.query,
      input.maxDocuments
    );

    // Fetch recent messages from database
    const recentMessages = input.chatId
      ? await this.fetchRecentMessages(input.chatId, input.maxMessages)
      : [];

    return {
      user,
      conversation: conversation ?? {
        chatId: "",
        title: "New Chat",
        visibility: "private",
        messageCount: 0,
      },
      relevantDocuments,
      recentMessages,
      metadata: {
        timestamp: new Date(),
        query: input.query,
        userId: input.userId,
      },
    };
  }

  hasPermission(user: UserContext, permission: string): boolean {
    return user.permissions.includes(permission);
  }

  private async fetchUser(userId: string): Promise<UserContext> {
    const result = await this.database.findById<{
      id: string;
      email: string;
      is_guest: boolean;
      permissions: string;
    }>("users", userId);

    if (!result) {
      throw new Error("User not found");
    }

    return {
      id: result.id,
      email: result.email,
      isGuest: result.is_guest,
      permissions: JSON.parse(result.permissions) as string[],
    };
  }

  private async fetchConversation(
    chatId: string
  ): Promise<ConversationContext> {
    const result = await this.database.findById<{
      id: string;
      title: string;
      visibility: "public" | "private";
      message_count: number;
    }>("chats", chatId);

    if (!result) {
      throw new Error("Chat not found");
    }

    return {
      chatId: result.id,
      title: result.title,
      visibility: result.visibility,
      messageCount: result.message_count,
    };
  }

  private async fetchRelevantDocuments(
    query: string,
    limit = 5
  ): Promise<RelevantDocument[]> {
    // ONLY place that uses vector search - via port
    const results = await this.vectorSearch.search({
      query,
      limit,
    });

    return results.map((r) => ({
      id: r.id,
      title: r.metadata.title as string,
      content: r.content,
      source: r.metadata.source as string,
      relevanceScore: r.score,
    }));
  }

  private async fetchRecentMessages(
    chatId: string,
    limit = 10
  ): Promise<MessageContext[]> {
    const results = await this.database.findMany<{
      id: string;
      role: "user" | "assistant";
      content: string;
      created_at: string;
    }>("messages", { chat_id: chatId });

    return results.slice(0, limit).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      timestamp: new Date(r.created_at),
    }));
  }
}
