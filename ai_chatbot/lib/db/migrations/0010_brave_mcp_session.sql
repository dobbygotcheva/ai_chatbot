CREATE TABLE IF NOT EXISTS "McpSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"sessionId" text NOT NULL,
	"accessToken" text NOT NULL,
	"serverUrl" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"lastUsedAt" timestamp
);
--> statement-breakdown
ALTER TABLE "McpSession" ADD CONSTRAINT "McpSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
