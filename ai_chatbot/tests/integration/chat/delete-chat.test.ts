/**
 * Integration tests for the delete chat feature.
 *
 * Exercises `deleteChatById` against a real Postgres database to verify the
 * transactional cascade removes every child row (messages, votes, stream,
 * token/tool usage) along with the parent chat, without touching unrelated
 * rows.
 *
 * Run with: pnpm test:integration
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

// `@/lib/db/queries` imports `server-only`, which throws when loaded outside a
// React Server Component. Stub it so the real queries (and their Drizzle
// transaction against the test database) can be exercised from Vitest.
vi.mock("server-only", () => ({}));

const { db } = await import("@/lib/db");
const { deleteChatById, getChatById, getMessagesByChatId } = await import(
  "@/lib/db/queries"
);

import {
  chat,
  message,
  stream,
  tokenUsage,
  toolUsage,
  user,
  vote,
} from "@/lib/db/schema";

const generateId = () => randomUUID();

type Seed = {
  userId: string;
  chatId: string;
  messageId: string;
};

async function seedChat(): Promise<Seed> {
  const userId = generateId();
  const chatId = generateId();
  const messageId = generateId();
  const streamId = generateId();

  await db()
    .insert(user)
    .values({
      id: userId,
      email: `delete-chat-${userId}@example.com`,
    });

  await db().insert(chat).values({
    id: chatId,
    userId,
    title: "Chat pending deletion",
    createdAt: new Date(),
  });

  await db().insert(message).values({
    id: messageId,
    chatId,
    role: "assistant",
    parts: [],
    attachments: [],
    createdAt: new Date(),
  });

  await db().insert(vote).values({
    chatId,
    messageId,
    isUpvoted: true,
  });

  await db().insert(stream).values({
    id: streamId,
    chatId,
    createdAt: new Date(),
  });

  await db().insert(tokenUsage).values({
    id: generateId(),
    userId,
    chatId,
    messageId,
    modelId: "foundation",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    createdAt: new Date(),
  });

  await db().insert(toolUsage).values({
    id: generateId(),
    userId,
    toolName: "getWeather",
    toolType: "base",
    chatId,
    messageId,
    success: true,
    durationMs: 42,
    createdAt: new Date(),
  });

  return { userId, chatId, messageId };
}

describe("deleteChatById (integration)", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    // Best-effort cleanup in case a test failed before deleting its chat.
    for (const userId of createdUserIds) {
      await db().delete(user).where(eq(user.id, userId));
    }
  });

  it("removes the chat together with all dependent rows", async () => {
    const { userId, chatId, messageId } = await seedChat();
    createdUserIds.push(userId);

    const deleted = await deleteChatById({ id: chatId });

    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(chatId);

    expect(await getChatById({ id: chatId })).toBeNull();
    expect(await getMessagesByChatId({ id: chatId })).toEqual([]);

    const remainingMessages = await db()
      .select()
      .from(message)
      .where(eq(message.id, messageId));
    expect(remainingMessages).toEqual([]);

    const remainingVotes = await db()
      .select()
      .from(vote)
      .where(eq(vote.chatId, chatId));
    expect(remainingVotes).toEqual([]);

    const remainingStreams = await db()
      .select()
      .from(stream)
      .where(eq(stream.chatId, chatId));
    expect(remainingStreams).toEqual([]);

    const remainingTokenUsage = await db()
      .select()
      .from(tokenUsage)
      .where(eq(tokenUsage.chatId, chatId));
    expect(remainingTokenUsage).toEqual([]);

    const remainingToolUsage = await db()
      .select()
      .from(toolUsage)
      .where(eq(toolUsage.chatId, chatId));
    expect(remainingToolUsage).toEqual([]);
  });

  it("returns undefined when the chat id does not exist", async () => {
    const result = await deleteChatById({ id: generateId() });
    expect(result).toBeUndefined();
  });

  it("does not affect sibling chats belonging to the same user", async () => {
    const seedA = await seedChat();
    const seedB = await seedChat();
    createdUserIds.push(seedA.userId, seedB.userId);

    await deleteChatById({ id: seedA.chatId });

    expect(await getChatById({ id: seedA.chatId })).toBeNull();

    const survivor = await getChatById({ id: seedB.chatId });
    expect(survivor).not.toBeNull();
    expect(survivor?.id).toBe(seedB.chatId);

    const survivorMessages = await db()
      .select()
      .from(message)
      .where(eq(message.chatId, seedB.chatId));
    expect(survivorMessages).toHaveLength(1);
    expect(survivorMessages[0].id).toBe(seedB.messageId);

    await deleteChatById({ id: seedB.chatId });
  });
});
