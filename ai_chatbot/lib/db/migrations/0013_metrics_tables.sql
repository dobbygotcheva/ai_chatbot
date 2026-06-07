-- Drop existing tables if they exist
DROP TABLE IF EXISTS "ToolUsage" CASCADE;
DROP TABLE IF EXISTS "TokenUsage" CASCADE;

-- Create ToolUsage table with proper integer columns
CREATE TABLE "ToolUsage" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "toolName" varchar(256) NOT NULL,
  "toolType" varchar NOT NULL,
  "chatId" uuid REFERENCES "Chat"("id"),
  "messageId" uuid REFERENCES "Message_v2"("id"),
  "success" boolean NOT NULL DEFAULT true,
  "errorMessage" text,
  "durationMs" integer NOT NULL,
  "inputTokens" integer,
  "outputTokens" integer,
  "createdAt" timestamp NOT NULL
);

-- Create TokenUsage table with proper integer columns
CREATE TABLE "TokenUsage" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "messageId" uuid REFERENCES "Message_v2"("id"),
  "modelId" varchar(256) NOT NULL,
  "inputTokens" integer NOT NULL,
  "outputTokens" integer NOT NULL,
  "totalTokens" integer NOT NULL,
  "createdAt" timestamp NOT NULL
);
