-- Add separate Jira and Confluence token columns to McpSession table
-- Also make accessToken nullable for backward compatibility

DO $$ 
BEGIN 
  -- Add jiraToken column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'McpSession' AND column_name = 'jiraToken'
  ) THEN
    ALTER TABLE "McpSession" ADD COLUMN "jiraToken" TEXT;
  END IF;

  -- Add confluenceToken column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'McpSession' AND column_name = 'confluenceToken'
  ) THEN
    ALTER TABLE "McpSession" ADD COLUMN "confluenceToken" TEXT;
  END IF;

  -- Make accessToken nullable (drop NOT NULL constraint)
  ALTER TABLE "McpSession" ALTER COLUMN "accessToken" DROP NOT NULL;
END $$;
