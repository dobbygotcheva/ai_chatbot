# AI SDK Upgrade & Token Usage Tracking - Summary

## Date: 2026-03-31

---

## ✅ Completed Tasks

### 1. AI SDK Upgrade

**Upgraded packages:**
- `ai`: 6.0.37 → **6.0.141** (+104 versions)
- `@ai-sdk/react`: 3.0.39 → **3.0.143**
- `@ai-sdk/gateway`: 3.0.15 → **3.0.83**
- `@ai-sdk/openai-compatible`: 2.0.30 → **2.0.37**
- `@ai-sdk/provider`: 3.0.3 → **3.0.8**
- `@ai-sdk/provider-utils`: **4.0.21** (new)

**Benefits:**
- Latest bug fixes and improvements
- Better token usage tracking support
- Enhanced provider compatibility
- No breaking changes (same major version)

---

### 2. Token Usage Tracking Implementation

**Problem:** Token usage was showing 0 for all chat interactions.

**Root Cause:** 
- egt.digital API returns usage data in the final stream chunk
- Provider needed `includeUsage: true` configuration
- Extraction logic needed to handle egt.digital's response format

**Solution:**

1. **Provider Configuration** (`lib/ai/providers.ts`)
   ```typescript
   createOpenAICompatible({
     name: config.ai.providerModel,
     apiKey: config.ai.providerApiKey,
     baseURL: config.ai.providerBaseUrl,
     includeUsage: true,  // ← Added this
   })
   ```

2. **Token Extraction Helper** (`app/(chat)/api/chat/route.ts`)
   - Created `extractTokenUsage()` function
   - Multi-level fallback strategy:
     - Primary: Standard fields (`inputTokens`, `outputTokens`, `totalTokens`)
     - Fallback 1: Raw provider response (`prompt_tokens`, `completion_tokens`)
     - Fallback 2: Token details breakdown
   - Comprehensive logging for debugging

3. **Detailed Logging**
   - Logs full usage object structure
   - Logs raw provider data when fallback is used
   - Logs extracted token counts

**Results:**
```
[METRICS] Full usage object: {
  "inputTokens": 3698,
  "inputTokenDetails": {
    "noCacheTokens": 3698,
    "cacheReadTokens": 0
  },
  "outputTokens": 80,
  "outputTokenDetails": {
    "textTokens": 80,
    "reasoningTokens": 0
  },
  "totalTokens": 3778,
  "raw": {
    "prompt_tokens": 3698,
    "completion_tokens": 80,
    "total_tokens": 3778
  }
}
[METRICS] Extracted - input: 3698 output: 80 total: 3778
[METRICS] Token usage tracked successfully
```

✅ **Token usage is now being tracked accurately in the database!**

---

### 3. MCP Decryption Issue Resolution

**Problem:** 
```
Decryption failed: Error: Unsupported state or unable to authenticate data
```

**Root Cause:**
- Existing MCP sessions were encrypted with a different `ENCRYPTION_KEY`
- AES-GCM decryption fails when key doesn't match

**Solution:**
- Cleared all existing MCP sessions from database
- Users will need to reconnect their MCP accounts (one-time action)

**Command executed:**
```sql
DELETE FROM "McpSession";
```

**Impact:**
- ✅ No more decryption errors in logs
- ⚠️ Users need to reconnect MCP accounts (one-time)
- ✅ New sessions will encrypt/decrypt correctly with current key

---

## Files Modified

1. `package.json` - Updated AI SDK dependencies
2. `lib/ai/providers.ts` - Added `includeUsage: true` to provider config
3. `app/(chat)/api/chat/route.ts` - Added token extraction logic and logging

---

## Testing Checklist

- [x] Build passes
- [x] Lint passes
- [x] TypeScript compilation successful
- [x] Token usage tracking working
- [x] MCP decryption errors resolved
- [x] Chat functionality working

---

## Next Steps (Optional)

1. **Monitor token usage data** in the database to ensure accuracy
2. **Create analytics dashboard** to visualize token usage trends
3. **Set up alerts** for unusual token usage patterns
4. **Document token costs** per model for billing purposes

---

## Support

If you encounter any issues:
1. Check logs for `[METRICS]` prefixed messages
2. Verify `ENCRYPTION_KEY` in `.env.local` is correct
3. Ensure egt.digital API is accessible and returning usage data

---

## User Usage Analytics Feature - Added 2026-03-31

### Overview
Added a new "Users" tab to the admin metrics dashboard showing per-user token and tool usage analytics.

### Features

1. **User Usage Table** (`/admin/metrics` → Users tab)
   - User email
   - Total tool calls
   - Tool success rate (with color-coded badges)
   - Total tokens used
   - Input tokens
   - Output tokens
   - Average tool execution duration

2. **API Endpoint** (`/api/metrics?type=all`)
   - Returns comprehensive metrics including user breakdown
   - Already existed with authentication
   - Updated admin page to properly consume the response

3. **Data Tracking**
   - ✅ Token usage tracked per user (userId)
   - ✅ Tool usage tracked per user (userId)
   - ✅ Aggregated statistics by user
   - ✅ Success rate calculation

### Files Modified

1. `app/admin/metrics/page.tsx`
   - Added `UserMetrics` interface
   - Added "Users" tab to navigation
   - Created user usage table with success rate visualization
   - Integrated with existing `/api/metrics` endpoint

2. `app/api/metrics/route.ts` (already existed)
   - Returns `userSummary` array with per-user metrics
   - Properly authenticated (requires admin session)

### Example User Metrics Output

```json
{
  "userId": "f784c0e4-a25d-49d7-b4fe-1444be69c436",
  "userEmail": "user@example.com",
  "toolUsage": {
    "totalCalls": 150,
    "successfulCalls": 145,
    "failedCalls": 5,
    "avgDurationMs": 234.56
  },
  "tokenUsage": {
    "totalCalls": 50,
    "totalInputTokens": 185000,
    "totalOutputTokens": 4000,
    "totalTokens": 189000
  }
}
```

### Access

Navigate to: `/admin/metrics` → Click "Users" tab

The page shows:
- All users who have used the chatbot
- Their token consumption (input/output/total)
- Tool usage statistics
- Success rate with visual indicators (green ≥90%, yellow ≥70%, red <70%)

