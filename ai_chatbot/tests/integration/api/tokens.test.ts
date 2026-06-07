/**
 * Integration tests for the token API routes (GET, POST, DELETE).
 *
 * Drives the exported route handlers against a real Postgres database,
 * stubbing only the next-auth `auth()` session and `@/shared/config`.
 *
 * Run with: pnpm test:integration tests/integration/api/tokens.test.ts
 */

import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sessionState = vi.hoisted(() => ({
  session: null as { user: { id: string; permissions?: string[] } } | null,
}));

vi.mock("@/app/(auth)/auth", () => ({
  auth: vi.fn(async () => sessionState.session),
}));

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
      auth: {
        secret: "test-secret-32-characters-long!!",
        url: "http://localhost:3000",
        m365BaseUrl: "http://localhost:8080",
        emailGroups: {},
      },
      azure: {
        adTenantId: "test-tenant-id",
        adClientId: "test-client-id",
        adClientSecret: "test-client-secret",
        graphApiUrl: "http://localhost:8080",
      },
      app: {
        env: "test",
        port: 3000,
        isDevelopment: false,
        isProduction: false,
        isTest: true,
        environment: "local",
      },
      ai: {
        providerApiKey: "test",
        providerBaseUrl: "http://test",
        providerModel: "test",
      },
      vector: {
        url: "http://localhost:6333",
        dimensions: 1024,
        apiKey: undefined,
        embeddingModel: "embedding",
      },
    },
  };
});

const { db } = await import("@/lib/db");
const { GET, POST } = await import("@/app/api/tokens/route");
const { DELETE } = await import("@/app/api/tokens/[id]/route");
const { apiToken, proxyAudit, user } = await import("@/lib/db/schema");

const generateId = () => randomUUID();

async function createUser(permissions: string[] = []): Promise<string> {
  const userId = generateId();
  await db()
    .insert(user)
    .values({
      id: userId,
      email: `tokens-api-${userId}@example.com`,
      permissions,
    });
  return userId;
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Token API (integration)", () => {
  const createdUserIds: string[] = [];

  beforeEach(() => {
    sessionState.session = null;
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db().delete(proxyAudit).where(eq(proxyAudit.userId, userId));
      await db().delete(apiToken).where(eq(apiToken.userId, userId));
      await db().delete(user).where(eq(user.id, userId));
    }
  });

  describe("GET /api/tokens", () => {
    it("returns 200 with tokens for authenticated user", async () => {
      const userId = await createUser(["llm"]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId, permissions: ["llm"] } };
      const postResponse = await POST(postRequest({ name: "Listable Token" }));
      expect(postResponse.status).toBe(201);

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.tokens).toBeInstanceOf(Array);
      expect(body.tokens.length).toBe(1);
      expect(body.tokens[0].name).toBe("Listable Token");
      expect(body.publicUrl).toBeNull();
    });

    it("returns 401 without auth", async () => {
      sessionState.session = null;
      const response = await GET();
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/tokens", () => {
    it("returns 201 with valid data and llm permission", async () => {
      const userId = await createUser(["llm"]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId, permissions: ["llm"] } };
      const response = await POST(postRequest({ name: "My Token" }));
      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.token).toBeDefined();
      expect(body.token.startsWith("sm-")).toBe(true);
      expect(body.name).toBe("My Token");
    });

    it("returns 403 without llm permission and logs TOKEN_CREATE_FORBIDDEN", async () => {
      const userId = await createUser([]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId } };
      const response = await POST(postRequest({ name: "No Perm Token" }));
      expect(response.status).toBe(403);

      const audit = await db()
        .select()
        .from(proxyAudit)
        .where(eq(proxyAudit.userId, userId));

      const forbiddenEntry = audit.find(
        (a) => a.action === "TOKEN_CREATE_FORBIDDEN"
      );
      expect(forbiddenEntry).toBeDefined();
      expect(forbiddenEntry?.success).toBe(false);
    });

    it("returns 429 when rate limited and logs TOKEN_CREATE_RATE_LIMITED", async () => {
      const userId = await createUser(["llm"]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId, permissions: ["llm"] } };

      for (let i = 0; i < 5; i++) {
        const res = await POST(postRequest({ name: `Rate Limit Token ${i}` }));
        expect(res.status).toBe(201);
      }

      const response = await POST(postRequest({ name: "Over Limit" }));
      expect(response.status).toBe(429);

      const audit = await db()
        .select()
        .from(proxyAudit)
        .where(eq(proxyAudit.userId, userId));

      const rateLimitedEntry = audit.find(
        (a) => a.action === "TOKEN_CREATE_RATE_LIMITED"
      );
      expect(rateLimitedEntry).toBeDefined();
      expect(rateLimitedEntry?.success).toBe(false);
    });

    it("returns 400 with invalid name", async () => {
      const userId = await createUser(["llm"]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId, permissions: ["llm"] } };
      const response = await POST(postRequest({ name: "" }));
      expect(response.status).toBe(400);
    });

    it("stores encrypted token in DB", async () => {
      const userId = await createUser(["llm"]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId, permissions: ["llm"] } };
      const response = await POST(postRequest({ name: "Encrypted Token" }));
      expect(response.status).toBe(201);

      const body = await response.json();
      const tokenId = body.id;

      const dbRow = await db()
        .select()
        .from(apiToken)
        .where(eq(apiToken.id, tokenId))
        .limit(1);

      expect(dbRow.length).toBe(1);
      expect(dbRow[0].encryptedToken).toBeDefined();
      expect(dbRow[0].encryptedToken).not.toBe(body.token);
      expect(dbRow[0].encryptedToken.length).toBeGreaterThan(0);
    });
  });

  describe("DELETE /api/tokens/[id]", () => {
    it("returns 200 for own token and logs TOKEN_REVOKED", async () => {
      const userId = await createUser(["llm"]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId, permissions: ["llm"] } };
      const postResponse = await POST(postRequest({ name: "To Revoke" }));
      expect(postResponse.status).toBe(201);
      const { id: tokenId } = await postResponse.json();

      const request = new Request(`http://localhost/api/tokens/${tokenId}`, {
        method: "DELETE",
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: tokenId }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);

      const audit = await db()
        .select()
        .from(proxyAudit)
        .where(eq(proxyAudit.userId, userId));

      const revokedEntry = audit.find((a) => a.action === "TOKEN_REVOKED");
      expect(revokedEntry).toBeDefined();
      expect(revokedEntry?.success).toBe(true);
      expect(revokedEntry?.tokenId).toBe(tokenId);

      const dbRow = await db()
        .select()
        .from(apiToken)
        .where(eq(apiToken.id, tokenId))
        .limit(1);
      expect(dbRow[0].revokedAt).not.toBeNull();
    });

    it("returns 404 for non-existent token", async () => {
      const userId = await createUser(["llm"]);
      createdUserIds.push(userId);

      sessionState.session = { user: { id: userId, permissions: ["llm"] } };
      const missingId = generateId();
      const request = new Request(`http://localhost/api/tokens/${missingId}`, {
        method: "DELETE",
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: missingId }),
      });
      expect(response.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      sessionState.session = null;
      const tokenId = generateId();
      const request = new Request(`http://localhost/api/tokens/${tokenId}`, {
        method: "DELETE",
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: tokenId }),
      });
      expect(response.status).toBe(401);
    });
  });
});
