-- Remove groups column (we now store only permissions)
ALTER TABLE "User" DROP COLUMN IF EXISTS "groups";
