CREATE TABLE IF NOT EXISTS "AppConnection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"appId" varchar(64) NOT NULL,
	"status" varchar DEFAULT 'connected' NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"tokenExpiresAt" timestamp,
	"config" json,
	"connectedAt" timestamp NOT NULL,
	"lastUsedAt" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AppConnection" ADD CONSTRAINT "AppConnection_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
