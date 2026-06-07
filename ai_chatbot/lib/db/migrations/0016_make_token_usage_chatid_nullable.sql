-- Make chatId nullable in TokenUsage table to support proxy server metrics
-- The proxy server doesn't have chat context, so we need to allow NULL values
ALTER TABLE "TokenUsage" ALTER COLUMN "chatId" DROP NOT NULL;
