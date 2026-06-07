-- AlterTable: Add serverName column to McpSession table
-- This allows multiple MCP server connections per user (e.g., Atlassian, Jira, etc.)

ALTER TABLE "McpSession"
ADD COLUMN "serverName" TEXT NOT NULL DEFAULT 'atlassian';

-- Add index for faster lookups by server name
CREATE INDEX IF NOT EXISTS "McpSession_serverName_idx" ON "McpSession"("serverName");

-- Add composite index for user + server name lookups
CREATE INDEX IF NOT EXISTS "McpSession_userId_serverName_idx" ON "McpSession"("userId", "serverName");
