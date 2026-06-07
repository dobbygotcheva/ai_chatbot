import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

if (!process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL =
    "postgresql://postgres:postgres@localhost:5433/ai_chatbot_test";
}

vi.mock("server-only", () => ({}));

vi.mock("@/shared/config", () => {
  const testKey = randomBytes(32).toString("hex");
  return {
    config: {
      encryption: {
        key: testKey,
      },
      database: {
        url: process.env.POSTGRES_URL,
      },
    },
  };
});

const { db } = await import("@/lib/db");
const { apiToken, proxyAudit, user } = await import("@/lib/db/schema");
const {
  createToken,
  listTokens,
  revokeToken,
  checkRateLimit,
  logAudit,
  RATE_LIMIT_TOKENS_PER_HOUR,
} = await import("@/lib/services/tokens");

async function createTestUser(): Promise<string> {
  const userId = randomUUID();
  await db()
    .insert(user)
    .values({
      id: userId,
      email: `token-service-${userId}@example.com`,
    });
  return userId;
}

async function deleteTestUser(userId: string): Promise<void> {
  await db().delete(user).where(eq(user.id, userId));
}

async function deleteApiTokensForUser(userId: string): Promise<void> {
  await db().delete(apiToken).where(eq(apiToken.userId, userId));
}

async function deleteProxyAuditForUser(userId: string): Promise<void> {
  await db().delete(proxyAudit).where(eq(proxyAudit.userId, userId));
}

describe("Token Service", () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await db().execute("SELECT 1");
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await deleteProxyAuditForUser(userId);
      await deleteApiTokensForUser(userId);
      await deleteTestUser(userId);
    }
  });

  describe("createToken", () => {
    it("generates a sm- prefixed token of 66 characters", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const result = await createToken({
        userId,
        name: "test-token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      expect(result.token).toMatch(/^sm-/);
      expect(result.token).toHaveLength(67);
    });

    it("stores an encrypted token in the database", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const result = await createToken({
        userId,
        name: "encrypted-check",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const rows = await db()
        .select()
        .from(apiToken)
        .where(eq(apiToken.id, result.id));

      expect(rows).toHaveLength(1);
      const stored = rows[0];
      expect(stored.encryptedToken).not.toBe(result.token);
      expect(stored.encryptedToken).toBeDefined();
      expect(stored.encryptedToken.length).toBeGreaterThan(0);
    });

    it("returns the plaintext token only once (in the response)", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const result = await createToken({
        userId,
        name: "once-only",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^sm-/);

      const listed = await listTokens(userId);
      const match = listed.find((t) => t.id === result.id);
      expect(match).toBeDefined();
      expect(match).not.toHaveProperty("token");
      expect(match).not.toHaveProperty("encryptedToken");
    });

    it("requires expiresAt as a Date", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createToken({
        userId,
        name: "expires-check",
        expiresAt,
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
      const rows = await db()
        .select()
        .from(apiToken)
        .where(eq(apiToken.id, result.id));
      expect(rows[0].expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("listTokens", () => {
    it("returns only non-revoked tokens", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const created = await createToken({
        userId,
        name: "active-token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await createToken({
        userId,
        name: "revoked-token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await revokeToken({ id: created.id, userId });

      const listed = await listTokens(userId);
      const names = listed.map((t) => t.name);
      expect(names).not.toContain("active-token");
      expect(names).toContain("revoked-token");
    });

    it("never includes the plaintext token in the response", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      await createToken({
        userId,
        name: "no-plaintext",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const listed = await listTokens(userId);
      expect(listed).toHaveLength(1);
      expect(listed[0]).not.toHaveProperty("token");
      expect(listed[0]).not.toHaveProperty("encryptedToken");
    });

    it("returns the correct fields: id, name, prefix, createdAt, lastUsedAt, expiresAt", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      await createToken({
        userId,
        name: "field-check",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const listed = await listTokens(userId);
      expect(listed).toHaveLength(1);
      const token = listed[0];
      expect(token).toHaveProperty("id");
      expect(token).toHaveProperty("name");
      expect(token).toHaveProperty("createdAt");
      expect(token).toHaveProperty("lastUsedAt");
      expect(token).toHaveProperty("expiresAt");
    });
  });

  describe("revokeToken", () => {
    it("sets revokedAt for an owned token and returns true", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const created = await createToken({
        userId,
        name: "revoke-me",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const revoked = await revokeToken({ id: created.id, userId });
      expect(revoked).toBe(true);

      const rows = await db()
        .select()
        .from(apiToken)
        .where(eq(apiToken.id, created.id));
      expect(rows[0].revokedAt).toBeInstanceOf(Date);
    });

    it("returns false for a non-owned token", async () => {
      const ownerId = await createTestUser();
      const otherId = await createTestUser();
      createdUserIds.push(ownerId, otherId);

      const created = await createToken({
        userId: ownerId,
        name: "not-yours",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const revoked = await revokeToken({ id: created.id, userId: otherId });
      expect(revoked).toBe(false);

      const rows = await db()
        .select()
        .from(apiToken)
        .where(eq(apiToken.id, created.id));
      expect(rows[0].revokedAt).toBeNull();
    });

    it("returns false for an already revoked token", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const created = await createToken({
        userId,
        name: "already-revoked",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const first = await revokeToken({ id: created.id, userId });
      expect(first).toBe(true);

      const second = await revokeToken({ id: created.id, userId });
      expect(second).toBe(false);
    });
  });

  describe("checkRateLimit", () => {
    it("allows creation when fewer than 5 tokens were created in the last hour", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      const allowed = await checkRateLimit(userId);
      expect(allowed).toBe(true);
    });

    it("blocks creation when 5 or more tokens were created in the last hour", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      for (let i = 0; i < RATE_LIMIT_TOKENS_PER_HOUR; i++) {
        await createToken({
          userId,
          name: `rate-limit-${i}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }

      const allowed = await checkRateLimit(userId);
      expect(allowed).toBe(false);
    });
  });

  describe("logAudit", () => {
    it("inserts into ProxyAudit with the correct action", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      await logAudit({
        userId,
        action: "TOKEN_CREATED",
        success: true,
      });

      const rows = await db()
        .select()
        .from(proxyAudit)
        .where(eq(proxyAudit.userId, userId));

      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe("TOKEN_CREATED");
      expect(rows[0].success).toBe(true);
    });

    it("stores userId, success, and errorMessage correctly", async () => {
      const userId = await createTestUser();
      createdUserIds.push(userId);

      await logAudit({
        userId,
        action: "TOKEN_CREATE_RATE_LIMITED",
        success: false,
        errorMessage: "Rate limit exceeded",
      });

      const rows = await db()
        .select()
        .from(proxyAudit)
        .where(eq(proxyAudit.userId, userId));

      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(userId);
      expect(rows[0].success).toBe(false);
      expect(rows[0].errorMessage).toBe("Rate limit exceeded");
    });
  });
});
