import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { config } from "@/shared/config";
import { decrypt, encrypt } from "../encryption";
import { ChatSDKError } from "../errors";
import { parsePgUrl } from "./connection";
import {
  type Chat,
  chat,
  type DBMessage,
  type McpSession as DbMcpSession,
  document,
  mcpSession,
  message,
  messageDeprecated,
  type Permission,
  type Suggestion,
  stream,
  suggestion,
  tokenUsage,
  toolUsage,
  type User,
  user,
  vote,
  voteDeprecated,
} from "./schema";
import { normalizeUserEmail } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// Lazy initialization to avoid database connection during build/prerendering
let _dbInstance: ReturnType<typeof drizzle> | null = null;

function db() {
  if (!_dbInstance) {
    // biome-ignore lint/style/noNonNullAssertion: Database URL is guaranteed to be set in config
    const client = postgres(parsePgUrl(config.database.url!) as never);
    _dbInstance = drizzle(client);
  }
  return _dbInstance;
}

export async function getUser(email: string): Promise<User[]> {
  const normalized = normalizeUserEmail(email);
  try {
    return await db()
      .select()
      .from(user)
      .where(sql`lower(${user.email}) = ${normalized}`);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

/** Returns null if no row (e.g. stale JWT after DB reset). */
export async function getUserById(id: string): Promise<User | null> {
  try {
    const [row] = await db()
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return row ?? null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("getUserById:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

export async function getUserByAzureAd(
  azureAdId: string
): Promise<User | null> {
  try {
    const [row] = await db()
      .select()
      .from(user)
      .where(eq(user.azureAdId, azureAdId))
      .limit(1);
    return row ?? null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("getUserByAzureAd:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

export type SessionUserSnapshot = {
  id: string;
};

/**
 * Ensure a `User` row exists for a signed-in session (JWT).
 * Recreates the row after DB reset / migrations when the session cookie still
 * references a valid user id (avoids Chat FK failures and 401 on /api/chat).
 */
export async function ensureUserForSessionUser(
  sessionUser: SessionUserSnapshot
): Promise<User> {
  const existing = await getUserById(sessionUser.id);
  if (existing) {
    return existing;
  }

  const email = `guest-${sessionUser.id}@session.local`.slice(0, 64);

  try {
    const [row] = await db()
      .insert(user)
      .values({
        id: sessionUser.id,
        email,
      } as typeof user.$inferInsert)
      .returning();
    return row;
  } catch (error) {
    const again = await getUserById(sessionUser.id);
    if (again) {
      return again;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("ensureUserForSessionUser:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

/**
 * Upsert user by Azure AD ID (M365 authentication)
 * Creates new user or updates existing M365 user with latest profile info
 */
export async function upsertUserByAzureAd({
  azureAdId,
  email,
  name,
  picture,
  permissions,
}: {
  azureAdId: string;
  email: string;
  name?: string;
  picture?: string | null;
  permissions: Permission[];
}) {
  try {
    const [result] = await db()
      .insert(user)
      .values({
        azureAdId,
        email,
        name: name ?? null,
        picture: picture ?? null,
        permissions,
      } as typeof user.$inferInsert)
      .onConflictDoUpdate({
        target: user.azureAdId,
        set: {
          email,
          name: name ?? null,
          picture: picture ?? null,
          permissions,
        },
      })
      .returning();

    return result;
  } catch (error) {
    console.error("Database upsert error:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert user by Azure AD ID"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db()
      .insert(chat)
      .values({
        id,
        createdAt: new Date(),
        userId,
        title,
        visibility,
      } as typeof chat.$inferInsert)
      /** Same chat id can be inserted twice on concurrent first-message requests. */
      .onConflictDoNothing({ target: chat.id });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("saveChat:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    // Run every child-row delete and the parent row in a single transaction so a
    // partial failure rolls back instead of leaving orphans.
    //
    // Child rows are removed in dependency order before the parent. We delete
    // from `TokenUsage` / `ToolUsage` explicitly because the cascade-delete
    // migration (0018_add_cascade_delete) was never registered in
    // `_journal.json`, so on databases where it never ran the FK constraints
    // there are still ON DELETE NO ACTION and would block the parent delete.
    return await db().transaction(async (tx) => {
      // Cascade-style cleanup: delete every row referencing this chat
      // before the parent. Vote rows must go before their Message parent.
      await tx.delete(tokenUsage).where(eq(tokenUsage.chatId, id));
      await tx.delete(toolUsage).where(eq(toolUsage.chatId, id));
      await tx.delete(vote).where(eq(vote.chatId, id));
      await tx.delete(voteDeprecated).where(eq(voteDeprecated.chatId, id));
      await tx.delete(message).where(eq(message.chatId, id));
      await tx
        .delete(messageDeprecated)
        .where(eq(messageDeprecated.chatId, id));
      await tx.delete(stream).where(eq(stream.chatId, id));

      const [chatsDeleted] = await tx
        .delete(chat)
        .where(eq(chat.id, id))
        .returning();
      return chatsDeleted;
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("deleteChatById:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db()
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    return await db().transaction(async (tx) => {
      await tx.delete(tokenUsage).where(inArray(tokenUsage.chatId, chatIds));
      await tx.delete(toolUsage).where(inArray(toolUsage.chatId, chatIds));
      await tx.delete(vote).where(inArray(vote.chatId, chatIds));
      await tx
        .delete(voteDeprecated)
        .where(inArray(voteDeprecated.chatId, chatIds));
      await tx.delete(message).where(inArray(message.chatId, chatIds));
      await tx
        .delete(messageDeprecated)
        .where(inArray(messageDeprecated.chatId, chatIds));
      await tx.delete(stream).where(inArray(stream.chatId, chatIds));

      const deletedChats = await tx
        .delete(chat)
        .where(eq(chat.userId, userId))
        .returning();

      return { deletedCount: deletedChats.length };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("deleteAllChatsByUserId:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
  includeTotal = false,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  /**
   * When true, also returns the total row count for this user's active chats.
   * Intended for the first (cursor-less) page request so the UI can render an
   * accurate "Page X of Y" label without having to pre-walk every page.
   */
  includeTotal?: boolean;
}) {
  try {
    const extendedLimit = limit + 1;

    // isNull(chat.archivedAt) excludes archived chats from the normal sidebar
    // history. Archived chats are retrieved separately via getArchivedChatsByUserId.
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM SQL type requires generic parameter
    const query = (whereCondition?: SQL<any>) =>
      db()
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id), isNull(chat.archivedAt))
            : and(eq(chat.userId, id), isNull(chat.archivedAt))
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db()
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db()
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;
    const chats = hasMore ? filteredChats.slice(0, limit) : filteredChats;

    // Only execute the COUNT query when explicitly requested (first page).
    // Running it for every cursor-paginated page would double the cost of
    // the history endpoint for no benefit.
    let total: number | undefined;
    if (includeTotal) {
      const [row] = await db()
        .select({ value: count() })
        .from(chat)
        .where(and(eq(chat.userId, id), isNull(chat.archivedAt)));
      total = row?.value ?? 0;
    }

    return {
      chats,
      hasMore,
      ...(total === undefined ? {} : { total }),
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in getChatsByUserId:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db()
      .select()
      .from(chat)
      .where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db()
      .insert(message)
      .values(messages as (typeof message.$inferInsert)[])
      /** Retries / duplicate submits can resend the same message id. */
      .onConflictDoNothing({ target: message.id });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("saveMessages:", errorMessage);
    throw new ChatSDKError("bad_request:database", errorMessage);
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db().update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db()
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db()
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db()
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db()
      .insert(vote)
      .values({
        chatId,
        messageId,
        isUpvoted: type === "up",
      } as typeof vote.$inferInsert);
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db().select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db()
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      } as typeof document.$inferInsert)
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db()
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db()
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db()
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db()
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db()
      .insert(suggestion)
      .values(suggestions as (typeof suggestion.$inferInsert)[]);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db()
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db().select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db()
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db()
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db()
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db()
      .update(chat)
      .set({ visibility } as Partial<typeof chat.$inferSelect>)
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db().update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update title for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db()
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db()
      .insert(stream)
      .values({
        id: streamId,
        chatId,
        createdAt: new Date(),
      } as typeof stream.$inferInsert);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db()
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ─── Archive / unarchive helpers ─────────────────────────────────────────────
// Archive is implemented as a soft-delete: we stamp archivedAt instead of
// removing the row. This means the data is never lost and the user can undo
// the action at any time from Settings → Data Controls.

/**
 * Soft-archives a single chat by recording the current timestamp.
 * The chat disappears from the normal sidebar but remains in the DB.
 */
export async function archiveChatById({ id }: { id: string }) {
  try {
    return await db()
      .update(chat)
      .set({ archivedAt: new Date() } as Partial<typeof chat.$inferSelect>)
      .where(eq(chat.id, id))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to archive chat by id"
    );
  }
}

/**
 * Restores an archived chat by clearing archivedAt.
 * The chat reappears in the normal sidebar history.
 */
export async function unarchiveChatById({ id }: { id: string }) {
  try {
    return await db()
      .update(chat)
      .set({ archivedAt: null } as Partial<typeof chat.$inferSelect>)
      .where(eq(chat.id, id))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to unarchive chat by id"
    );
  }
}

/**
 * Archives every active (non-archived) chat for a user in a single UPDATE.
 * Called by the "Archive all chats" button in Settings → Data Controls.
 * We filter isNull(archivedAt) so already-archived chats don't get a fresh
 * timestamp (which would reset their archive date unnecessarily).
 */
export async function archiveAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const archived = await db()
      .update(chat)
      .set({ archivedAt: new Date() } as Partial<typeof chat.$inferSelect>)
      .where(and(eq(chat.userId, userId), isNull(chat.archivedAt)))
      .returning({ id: chat.id });

    return { archivedCount: archived.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to archive all chats by user id"
    );
  }
}

/**
 * Cursor-paginated list of archived chats (archivedAt IS NOT NULL).
 * Mirrors getChatsByUserId but with the opposite nullability filter.
 * Used by GET /api/history?archived=true and the "View archives" dialog.
 */
export async function getArchivedChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
  includeTotal = false,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  /**
   * When true, also returns the total count of archived chats for this user.
   * Mirrors the same-named flag on getChatsByUserId — the caller should only
   * request it on the first (cursor-less) page to avoid paying for the COUNT
   * on every subsequent page fetch.
   */
  includeTotal?: boolean;
}) {
  try {
    const extendedLimit = limit + 1;

    // We fetch limit+1 rows to cheaply determine whether a next page exists,
    // then slice back to limit before returning. Same pattern as getChatsByUserId.
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM SQL type requires generic parameter
    const query = (whereCondition?: SQL<any>) =>
      db()
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(
                whereCondition,
                eq(chat.userId, id),
                isNotNull(chat.archivedAt)
              )
            : and(eq(chat.userId, id), isNotNull(chat.archivedAt))
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db()
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db()
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;
    const chats = hasMore ? filteredChats.slice(0, limit) : filteredChats;

    let total: number | undefined;
    if (includeTotal) {
      const [row] = await db()
        .select({ value: count() })
        .from(chat)
        .where(and(eq(chat.userId, id), isNotNull(chat.archivedAt)));
      total = row?.value ?? 0;
    }

    return {
      chats,
      hasMore,
      ...(total === undefined ? {} : { total }),
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in getArchivedChatsByUserId:", errorMessage);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get archived chats by user id"
    );
  }
}

/**
 * Fetches ALL chats (active + archived) for a user together with their
 * Message_v2 rows, used exclusively for the JSON data-export endpoint.
 * Mirrors getChatsByUserId but with the opposite nullability filter.
 * Messages are fetched in a single IN query rather than N per-chat queries
 * to avoid performance issues for users with many conversations.
 */
export async function exportUserData({ userId }: { userId: string }) {
  try {
    const userChats = await db()
      .select()
      .from(chat)
      .where(eq(chat.userId, userId))
      .orderBy(desc(chat.createdAt));

    const chatIds = userChats.map((c) => c.id);

    // Guard against the empty-array edge case: some DB drivers error on
    // WHERE chatId IN () with an empty list.
    const messages =
      chatIds.length > 0
        ? await db()
            .select()
            .from(message)
            .where(inArray(message.chatId, chatIds))
            .orderBy(asc(message.createdAt))
        : [];

    return { chats: userChats, messages };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to export user data"
    );
  }
}

// ─── MCP Session Queries (Runtime Session Management) ────────────────────────

/**
 * Create or update an MCP session for a user.
 * @param serverName - The name of the MCP server (e.g., "atlassian", "jira")
 */
export async function createMcpSession({
  userId,
  sessionId,
  accessToken,
  jiraToken,
  confluenceToken,
  serverUrl,
  serverName = "atlassian",
}: {
  userId: string;
  sessionId: string;
  accessToken?: string | null;
  jiraToken?: string | null;
  confluenceToken?: string | null;
  serverUrl: string;
  serverName?: string;
}) {
  try {
    // Delete any existing session for this user and server first
    await db()
      .delete(mcpSession)
      .where(
        and(
          eq(mcpSession.userId, userId),
          eq(mcpSession.serverName, serverName)
        )
      );

    const [newSession] = await db()
      .insert(mcpSession)
      .values({
        userId,
        sessionId,
        accessToken: encrypt(accessToken),
        jiraToken: encrypt(jiraToken),
        confluenceToken: encrypt(confluenceToken),
        serverUrl,
        serverName,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      } as typeof mcpSession.$inferInsert)
      .returning();

    return newSession;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create MCP session"
    );
  }
}

/**
 * Get the MCP session for a user.
 * @param serverName - Optional server name filter (defaults to "atlassian" for backward compatibility)
 */
export async function getMcpSessionByUserId({
  userId,
  serverName = "atlassian",
}: {
  userId: string;
  serverName?: string;
}): Promise<DbMcpSession | null> {
  try {
    const [session] = await db()
      .select()
      .from(mcpSession)
      .where(
        and(
          eq(mcpSession.userId, userId),
          eq(mcpSession.serverName, serverName)
        )
      );

    if (!session) {
      return null;
    }

    // Decrypt tokens before returning
    return {
      ...session,
      accessToken: decrypt(session.accessToken),
      jiraToken: decrypt(session.jiraToken),
      confluenceToken: decrypt(session.confluenceToken),
    };
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get MCP session");
  }
}

/**
 * Get all MCP sessions for a user (for multiple server connections).
 */
export async function getAllMcpSessionsByUserId({
  userId,
}: {
  userId: string;
}): Promise<DbMcpSession[]> {
  let sessions: DbMcpSession[] = [];

  try {
    sessions = await db()
      .select()
      .from(mcpSession)
      .where(eq(mcpSession.userId, userId));

    // Decrypt tokens before returning, handling errors gracefully
    return sessions.map((session) => ({
      ...session,
      accessToken: decrypt(session.accessToken) ?? "",
      jiraToken: decrypt(session.jiraToken) ?? "",
      confluenceToken: decrypt(session.confluenceToken) ?? "",
    }));
  } catch (_error) {
    console.error("[DB] Failed to get MCP sessions:", _error);
    // Return empty array on error
    return [];
  }
}

/**
 * Delete the MCP session for a user.
 * @param serverName - Optional server name filter (deletes all sessions if not provided)
 */
export async function deleteMcpSessionByUserId({
  userId,
  serverName,
}: {
  userId: string;
  serverName?: string;
}) {
  try {
    if (serverName) {
      return await db()
        .delete(mcpSession)
        .where(
          and(
            eq(mcpSession.userId, userId),
            eq(mcpSession.serverName, serverName)
          )
        );
    }
    return await db().delete(mcpSession).where(eq(mcpSession.userId, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete MCP session"
    );
  }
}

/**
 * Clears Jira or Confluence token on the legacy `atlassian` session row (if present).
 * Removes the row when no tokens remain.
 */
export async function clearAtlassianMcpProductToken({
  userId,
  product,
}: {
  userId: string;
  product: "jira" | "confluence";
}) {
  try {
    const row = await getMcpSessionByUserId({
      userId,
      serverName: "atlassian",
    });
    if (!row) {
      return;
    }
    await db()
      .update(mcpSession)
      .set(product === "jira" ? { jiraToken: null } : { confluenceToken: null })
      .where(eq(mcpSession.id, row.id));

    const [updated] = await db()
      .select()
      .from(mcpSession)
      .where(eq(mcpSession.id, row.id));
    if (
      updated &&
      !updated.accessToken &&
      !updated.jiraToken &&
      !updated.confluenceToken
    ) {
      await db().delete(mcpSession).where(eq(mcpSession.id, row.id));
    }
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to clear MCP token");
  }
}

/**
 * Update the lastUsedAt timestamp for an MCP session.
 */
export async function updateMcpSessionLastUsed({
  sessionId,
}: {
  sessionId: string;
}) {
  try {
    return await db()
      .update(mcpSession)
      .set({ lastUsedAt: new Date() } as Partial<
        typeof mcpSession.$inferSelect
      >)
      .where(eq(mcpSession.sessionId, sessionId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update MCP session"
    );
  }
}
