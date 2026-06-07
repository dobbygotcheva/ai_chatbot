# Metrics Testing Guide

## Overview

This document describes the testing strategy for metrics tracking functions.

## Test Files

### Unit Tests
- **Location**: `tests/unit/metrics/metrics.test.ts`
- **Purpose**: Test metrics functions with mocked database
- **Run**: `pnpm test tests/unit/metrics/metrics.test.ts`

### Integration Tests  
- **Location**: `tests/integration/metrics/tracking.test.ts`
- **Purpose**: Test actual database writes and reads
- **Requirements**: Test database connection
- **Run**: Requires manual setup (see below)

## What's Tested

### ✅ Unit Tests (Automated)

1. **trackToolUsage**
   - Tracks successful tool usage
   - Tracks failed tool usage with error messages
   - Handles optional fields correctly

2. **trackTokenUsage**
   - Tracks token usage with all required fields
   - Handles optional messageId

3. **getToolUsageMetrics**
   - Fetches metrics by user ID
   - Fetches metrics with date range filters

4. **getTokenUsageMetrics**
   - Fetches token metrics by user ID
   - Fetches metrics for specific chat

5. **getAggregatedToolUsage**
   - Returns aggregated statistics
   - Filters by user

6. **getAggregatedTokenUsage**
   - Returns aggregated token statistics
   - Filters by date range

### ✅ Integration Tests (Manual)

The integration tests verify:

1. **Database Writes**
   - `trackTokenUsage()` correctly inserts records
   - `trackToolUsage()` correctly inserts records
   - All fields are saved with correct types
   - Optional fields handled properly

2. **Database Reads**
   - `getTokenUsageMetrics()` retrieves correct data
   - `getToolUsageMetrics()` retrieves correct data
   - Aggregation functions return accurate results
   - User summary functions work correctly

3. **Data Integrity**
   - Foreign key relationships maintained
   - Numeric fields stored correctly
   - Timestamps recorded accurately
   - Boolean fields preserved

## Running Integration Tests Manually

### Prerequisites

1. Test database must be accessible
2. Database user must have INSERT/SELECT/DELETE permissions
3. Environment variables configured:
   ```bash
   POSTGRES_URL=postgresql://user:pass@host:5432/test_db
   ```

### Steps

1. **Update vitest config** (already done):
   ```typescript
   include: [
     "tests/unit/**/*.test.{ts,tsx}",
     "tests/integration/**/*.test.{ts,tsx}",
   ],
   ```

2. **Run with node environment**:
   ```bash
   cd ai_chatbot
   pnpm exec vitest run tests/integration/metrics/tracking.test.ts --environment=node
   ```

3. **Verify test data cleanup**:
   Tests automatically clean up test data using the `afterAll` hook.

## Test Coverage

### Functions Covered

- [x] `trackTokenUsage()`
- [x] `trackToolUsage()`
- [x] `getTokenUsageMetrics()`
- [x] `getToolUsageMetrics()`
- [x] `getAggregatedTokenUsage()`
- [x] `getAggregatedToolUsage()`
- [x] `getUserMetricsSummary()`
- [x] `getUserDetailedMetrics()`

### Database Tables

- [x] `TokenUsage` - Insert and query
- [x] `ToolUsage` - Insert and query
- [x] `User` - Create test users
- [x] `Chat` - Create test chats
- [x] `Message` - Create test messages

## Manual Testing Checklist

For production verification:

1. **Send a chat message** and verify:
   - [ ] Token usage recorded in `TokenUsage` table
   - [ ] Correct input/output/total tokens
   - [ ] Associated with correct user and chat
   - [ ] Timestamp is accurate

2. **Use a tool** (e.g., getWeather) and verify:
   - [ ] Tool usage recorded in `ToolUsage` table
   - [ ] Correct tool name and type
   - [ ] Success/failure status recorded
   - [ ] Duration in milliseconds
   - [ ] Error message saved if failed

3. **Check admin metrics page** (`/admin/metrics`):
   - [ ] Overview shows correct totals
   - [ ] Tools tab shows breakdown by tool
   - [ ] Tokens tab shows breakdown by model
   - [ ] Users tab shows per-user statistics
   - [ ] Click user to see detailed breakdown

4. **Test user detail page** (`/admin/metrics/users/[userId]`):
   - [ ] Overview shows user summary
   - [ ] Tool breakdown by name
   - [ ] Token breakdown by model
   - [ ] Recent activity lists

## Debugging Tips

### If tracking functions fail:

1. Check database connection:
   ```bash
   pnpm db:studio
   ```

2. Verify tables exist:
   ```sql
   \dt "TokenUsage"
   \dt "ToolUsage"
   ```

3. Check recent records:
   ```sql
   SELECT * FROM "TokenUsage" ORDER BY "createdAt" DESC LIMIT 10;
   SELECT * FROM "ToolUsage" ORDER BY "createdAt" DESC LIMIT 10;
   ```

### If metrics page shows no data:

1. Verify API endpoint:
   ```bash
   curl http://localhost:3000/api/metrics?type=all
   ```

2. Check console logs for `[METRICS]` prefixed messages

3. Verify user has chat history with tool/token usage

## Future Improvements

- [ ] Set up dedicated test database for CI/CD
- [ ] Add performance tests for large datasets
- [ ] Add tests for date range filtering
- [ ] Add tests for pagination
- [ ] Add E2E tests for admin metrics UI
- [ ] Add load testing for concurrent tracking

