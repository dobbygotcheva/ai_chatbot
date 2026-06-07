-- Remove legacy password column (we use Azure AD authentication now)
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";
