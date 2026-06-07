import { createHmac, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ONE_HOUR_MS } from "@/lib/constants";
import { db } from "@/lib/db";
import { apiToken, proxyAudit } from "@/lib/db/schema";
import { getEncryptionKey } from "@/lib/encryption";

export const RATE_LIMIT_TOKENS_PER_HOUR = 5;
export const TOKEN_NAME_MAX_LENGTH = 256;

function hashToken(token: string): string {
  return createHmac("sha256", getEncryptionKey()).update(token).digest("hex");
}

export async function createToken(params: {
  userId: string;
  name: string;
  expiresAt: Date;
}): Promise<{
  id: string;
  name: string;
  createdAt: Date;
  expiresAt: Date;
  token: string;
}> {
  const token = `sm-${randomBytes(32).toString("hex")}`;
  const tokenHash = hashToken(token);

  const result = await db()
    .insert(apiToken)
    .values({
      userId: params.userId,
      name: params.name,
      encryptedToken: tokenHash, // Reusing column for HMAC hash
      expiresAt: params.expiresAt,
      createdAt: new Date(),
    })
    .returning();

  const created = result[0];

  return {
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
    token,
  };
}

export async function listTokens(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    expiresAt: Date;
  }>
> {
  const results = await db()
    .select()
    .from(apiToken)
    .where(and(eq(apiToken.userId, userId), isNull(apiToken.revokedAt)))
    .orderBy(desc(apiToken.createdAt));

  return results.map((t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
    expiresAt: t.expiresAt,
  }));
}

export async function revokeToken(params: {
  id: string;
  userId: string;
}): Promise<boolean> {
  const result = await db()
    .update(apiToken)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiToken.id, params.id),
        eq(apiToken.userId, params.userId),
        isNull(apiToken.revokedAt)
      )
    )
    .returning();

  return result.length > 0;
}

export async function checkRateLimit(userId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);

  const results = await db()
    .select()
    .from(apiToken)
    .where(
      and(
        eq(apiToken.userId, userId),
        sql`${apiToken.createdAt} >= ${oneHourAgo.toISOString()}`
      )
    );

  return results.length < RATE_LIMIT_TOKENS_PER_HOUR;
}

export async function logAudit(params: {
  userId: string;
  tokenId?: string;
  action:
    | "TOKEN_CREATED"
    | "TOKEN_REVOKED"
    | "TOKEN_CREATE_FORBIDDEN"
    | "TOKEN_CREATE_RATE_LIMITED";
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await db().insert(proxyAudit).values({
    userId: params.userId,
    tokenId: params.tokenId,
    action: params.action,
    success: params.success,
    errorMessage: params.errorMessage,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt: new Date(),
  });
}
