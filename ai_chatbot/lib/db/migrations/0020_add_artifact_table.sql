-- Create Artifact table for storing code execution files and images
CREATE TABLE IF NOT EXISTS "Artifact" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "createdAt" timestamp NOT NULL,
  "userId" uuid NOT NULL,
  "chatId" uuid NOT NULL,
  "messageId" uuid NOT NULL,
  "filename" text NOT NULL,
  "contentType" varchar(128) NOT NULL,
  "size" integer NOT NULL,
  "data" text NOT NULL,
  "kind" varchar NOT NULL,
  "metadata" json DEFAULT '{}',
  CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Artifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Artifact_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE,
  CONSTRAINT "Artifact_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE,
  CONSTRAINT "Artifact_kind_check" CHECK ("kind" IN ('image', 'file', 'document', 'spreadsheet', 'archive', 'other')),
  CONSTRAINT "Artifact_size_check" CHECK ("size" >= 0 AND "size" <= 5242880)
);

-- Create index on chatId for fast lookups
CREATE INDEX IF NOT EXISTS "Artifact_chatId_idx" ON "Artifact"("chatId");

-- Create index on messageId for fast lookups
CREATE INDEX IF NOT EXISTS "Artifact_messageId_idx" ON "Artifact"("messageId");

-- Create index on userId for fast lookups
CREATE INDEX IF NOT EXISTS "Artifact_userId_idx" ON "Artifact"("userId");

-- Create composite index on chatId and messageId for common query patterns
CREATE INDEX IF NOT EXISTS "Artifact_chat_message_idx" ON "Artifact"("chatId", "messageId");
