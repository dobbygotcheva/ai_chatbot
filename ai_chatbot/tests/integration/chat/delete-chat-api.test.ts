/**
 * Integration tests for the DELETE /api/chat?id=<chatId> route handler.
 *
 * Drives the exported `DELETE` handler against a real Postgres database,
 * stubbing only the next-auth `auth()` session so the ownership / already-
 * deleted / unauthenticated branches can each be exercised without standing
 * up a full Next.js server.
 *
 * Replaces a previous unit test that mocked Drizzle's transaction internals
 * and asserted implementation details (delete order, `returning()` call
 * counts) rather than observable behaviour.
 *
 * Run with: pnpm test:integration
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// `@/lib/db/queries` guards against client-side imports via `server-only`.
vi.mock("server-only", () => ({}));

// Shared mutable session so individual tests can flip between authenticated,
// other-user, and anonymous without re-importing the route handler.
const sessionState = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));

// Stub auth so the DELETE handler's `await auth()` call is fully under test
// control.
vi.mock("@/app/(auth)/auth", () => ({
  auth: vi.fn(async () => sessionState.session),
}));

// `@/lib/db/queries` is otherwise passed through to the real implementation
// — only `deleteChatById` can be opted into a stub when a test needs to
// simulate a non-`ChatSDKError` failure (e.g. the transactional rollback
// branch that maps to `bad_request:database` → HTTP 400).
const queryOverrides = vi.hoisted(() => ({
  deleteChatById: null as null | ((args: { id: string }) => Promise<unknown>),
}));

vi.mock("@/lib/db/queries", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/db/queries")>(
      "@/lib/db/queries"
    );
  return {
    ...actual,
    deleteChatById: (args: { id: string }) =>
      queryOverrides.deleteChatById
        ? queryOverrides.deleteChatById(args)
        : actual.deleteChatById(args),
  };
});

const { db } = await import("@/lib/db");
const { DELETE } = await import("@/app/(chat)/api/chat/route");
const { chat, message, stream, tokenUsage, toolUsage, user, vote } =
  await import("@/lib/db/schema");

const generateId = () => randomUUID();

async function createUser(): Promise<string> {
  const userId = generateId();
  await db()
    .insert(user)
    .values({
      id: userId,
      email: `delete-api-${userId}@example.com`,
    });
  return userId;
}

type Seed = {
  chatId: string;
  messageId: string;
};

async function seedChat(userId: string): Promise<Seed> {
  const chatId = generateId();
  const messageId = generateId();
  const streamId = generateId();

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

  return { chatId, messageId };
}

function deleteRequest(id: string | null): Request {
  const url = new URL("http://localhost/api/chat");
  if (id !== null) {
    url.searchParams.set("id", id);
  }
  return new Request(url.toString(), { method: "DELETE" });
}

describe("DELETE /api/chat (integration)", () => {
  const createdUserIds: string[] = [];

  beforeEach(() => {
    sessionState.session = null;
    queryOverrides.deleteChatById = null;
  });

  afterAll(async () => {
    // Best-effort cleanup in case a test failed before its chat was deleted.
    // User rows are only removed once here so sibling tests stay isolated.
    for (const userId of createdUserIds) {
      await db().delete(user).where(eq(user.id, userId));
    }
  });

  it("returns 200 and actually deletes the chat with all dependent rows", async () => {
    const userId = await createUser();
    createdUserIds.push(userId);
    const { chatId } = await seedChat(userId);

    sessionState.session = { user: { id: userId } };

    const response = await DELETE(deleteRequest(chatId));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body?.id).toBe(chatId);

    const remainingChat = await db()
      .select()
      .from(chat)
      .where(eq(chat.id, chatId));
    expect(remainingChat).toEqual([]);

    // Cascade: rows in every child table must be gone too — verifies the
    // handler actually routed through the transactional `deleteChatById`.
    const remainingMessages = await db()
      .select()
      .from(message)
      .where(eq(message.chatId, chatId));
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

  it("returns 200 with alreadyDeleted: true when the chat is already gone", async () => {
    const userId = await createUser();
    createdUserIds.push(userId);

    sessionState.session = { user: { id: userId } };

    const missingId = generateId();
    const response = await DELETE(deleteRequest(missingId));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ id: missingId, alreadyDeleted: true });
  });

  it("is idempotent: a second DELETE on the same chat returns alreadyDeleted: true", async () => {
    const userId = await createUser();
    createdUserIds.push(userId);
    const { chatId } = await seedChat(userId);

    sessionState.session = { user: { id: userId } };

    // First DELETE performs the actual cascade — returns the deleted row.
    const first = await DELETE(deleteRequest(chatId));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody?.id).toBe(chatId);
    expect(firstBody?.alreadyDeleted).toBeUndefined();

    // Second DELETE on the same id must be a no-op 200 rather than a 404
    // or 403 — a double-click on the "Delete" button or a stale client
    // list should resolve cleanly from the user's perspective.
    const second = await DELETE(deleteRequest(chatId));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody).toEqual({ id: chatId, alreadyDeleted: true });
  });

  it("returns 403 and preserves the chat when the caller does not own it", async () => {
    const ownerId = await createUser();
    const intruderId = await createUser();
    createdUserIds.push(ownerId, intruderId);

    const { chatId } = await seedChat(ownerId);

    sessionState.session = { user: { id: intruderId } };

    const response = await DELETE(deleteRequest(chatId));

    expect(response.status).toBe(403);

    // Invariant: a forbidden delete must never mutate the database.
    const stillThere = await db()
      .select()
      .from(chat)
      .where(eq(chat.id, chatId));
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0].userId).toBe(ownerId);

    // Sanity-check a child row too — if the transaction ever leaked past the
    // ownership guard we'd see orphaned deletes here.
    const messages = await db()
      .select()
      .from(message)
      .where(eq(message.chatId, chatId));
    expect(messages).toHaveLength(1);

    // Owner cleans up so afterAll can drop the seeded user row.
    sessionState.session = { user: { id: ownerId } };
    const cleanup = await DELETE(deleteRequest(chatId));
    expect(cleanup.status).toBe(200);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    sessionState.session = null;

    const response = await DELETE(deleteRequest(generateId()));

    expect(response.status).toBe(401);
  });

  it("returns 400 when the id query parameter is missing", async () => {
    const response = await DELETE(deleteRequest(null));

    expect(response.status).toBe(400);
  });

  it("returns 400 bad_request:database when deleteChatById throws a non-ChatSDKError", async () => {
    const userId = await createUser();
    createdUserIds.push(userId);
    const { chatId } = await seedChat(userId);

    sessionState.session = { user: { id: userId } };

    // Force the transactional delete to fail so we exercise the handler's
    // catch-all branch that wraps raw errors in a `bad_request:database`
    // `ChatSDKError`. The ownership guard still runs against the real DB
    // first, so this only kicks in for the *owner* path — a forbidden or
    // already-deleted request never reaches `deleteChatById`.
    queryOverrides.deleteChatById = () =>
      Promise.reject(new Error("simulated DB failure"));

    const response = await DELETE(deleteRequest(chatId));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("bad_request:database");
    // The raw error message is surfaced via `cause` so failed deletes are
    // debuggable in the client's network tab — guard that contract here so
    // a future refactor can't silently swallow it.
    expect(body.cause).toBe("simulated DB failure");

    // Because the stub short-circuited before any DB writes, the chat must
    // still exist — a broken rollback would show up as missing rows here.
    queryOverrides.deleteChatById = null;
    const stillThere = await db()
      .select()
      .from(chat)
      .where(eq(chat.id, chatId));
    expect(stillThere).toHaveLength(1);

    // Clean up with the real implementation so afterAll can drop the user.
    const cleanup = await DELETE(deleteRequest(chatId));
    expect(cleanup.status).toBe(200);
  });
});
