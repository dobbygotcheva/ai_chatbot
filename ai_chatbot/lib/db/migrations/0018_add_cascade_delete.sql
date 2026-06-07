-- Add cascade delete to chat relationships
-- This allows deleting chats which automatically deletes related messages, votes, streams, and token usage

-- Message_v2: cascade delete when chat is deleted
ALTER TABLE "Message_v2" 
  DROP CONSTRAINT IF EXISTS "Message_v2_chatId_fkey",
  ADD CONSTRAINT "Message_v2_chatId_fkey" 
    FOREIGN KEY ("chatId") 
    REFERENCES "Chat"("id") 
    ON DELETE CASCADE;

-- Vote_v2: cascade delete when chat is deleted
ALTER TABLE "Vote_v2" 
  DROP CONSTRAINT IF EXISTS "Vote_v2_chatId_fkey",
  ADD CONSTRAINT "Vote_v2_chatId_fkey" 
    FOREIGN KEY ("chatId") 
    REFERENCES "Chat"("id") 
    ON DELETE CASCADE;

-- Stream: cascade delete when chat is deleted
ALTER TABLE "Stream" 
  DROP CONSTRAINT IF EXISTS "Stream_chatId_fkey",
  ADD CONSTRAINT "Stream_chatId_fkey" 
    FOREIGN KEY ("chatId") 
    REFERENCES "Chat"("id") 
    ON DELETE CASCADE;

-- ToolUsage: cascade delete when chat is deleted
ALTER TABLE "ToolUsage" 
  DROP CONSTRAINT IF EXISTS "ToolUsage_chatId_fkey",
  ADD CONSTRAINT "ToolUsage_chatId_fkey" 
    FOREIGN KEY ("chatId") 
    REFERENCES "Chat"("id") 
    ON DELETE CASCADE;

-- TokenUsage: cascade delete when chat is deleted
ALTER TABLE "TokenUsage" 
  DROP CONSTRAINT IF EXISTS "TokenUsage_chatId_fkey",
  ADD CONSTRAINT "TokenUsage_chatId_fkey" 
    FOREIGN KEY ("chatId") 
    REFERENCES "Chat"("id") 
    ON DELETE CASCADE;
