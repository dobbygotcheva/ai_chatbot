-- Create ApiToken table for LLM proxy authentication
CREATE TABLE IF NOT EXISTS "ApiToken" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "name" varchar(256) NOT NULL,
  "encryptedToken" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL,
  "lastUsedAt" timestamp,
  "revokedAt" timestamp,
  CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create index on encryptedToken for token lookup
CREATE INDEX IF NOT EXISTS "ApiToken_encryptedToken_idx" ON "ApiToken"("encryptedToken");

-- Create index on expiresAt for expiration checks
CREATE INDEX IF NOT EXISTS "ApiToken_expiresAt_idx" ON "ApiToken"("expiresAt");

-- Create ProxyAudit table for request logging
CREATE TABLE IF NOT EXISTS "ProxyAudit" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "tokenId" uuid,
  "action" varchar(64) NOT NULL,
  "ipAddress" varchar(45),
  "userAgent" text,
  "success" boolean NOT NULL DEFAULT true,
  "errorMessage" text,
  "createdAt" timestamp NOT NULL,
  CONSTRAINT "ProxyAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProxyAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ProxyAudit_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ApiToken"("id") ON DELETE SET NULL
);

-- Create index on createdAt for audit queries
CREATE INDEX IF NOT EXISTS "ProxyAudit_createdAt_idx" ON "ProxyAudit"("createdAt");
