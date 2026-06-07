-- Migration: M365 Authentication
-- Purpose: Replace password-based auth with Azure AD / M365 SSO
-- Changes:
--   1. Add Azure AD columns (azureAdId, name, picture)
--   2. Add RBAC columns (groups, permissions)
--   3. Make password nullable (deprecated)

-- Add new columns for M365 authentication (safe to run multiple times)
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "name" varchar(64);

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "azureAdId" varchar(128);

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "picture" text;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "groups" json DEFAULT '[]'::json;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "permissions" json DEFAULT '[]'::json;

-- Make password nullable (for backward compatibility during migration)
ALTER TABLE "User"
ALTER COLUMN "password" DROP NOT NULL;

-- Add unique constraint on azureAdId
-- Note: Will fail if already exists, which is ok - constraint is already there
ALTER TABLE "User"
ADD CONSTRAINT "User_azureAdId_unique" UNIQUE ("azureAdId");

-- Add index for faster Azure AD lookups
CREATE INDEX IF NOT EXISTS "User_azureAdId_idx" ON "User" ("azureAdId");

-- Add index for email lookups (still used for user identification)
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User" ("email");

-- Note: Existing password column is kept but will not be used for M365 users
-- New M365 users will have NULL password and non-NULL azureAdId
