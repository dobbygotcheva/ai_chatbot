# MR 61 Changes - "feat: split get web results tool into two"

This document summarizes the code changes made to address the code review recommendations for MR 61.

---

## Summary of Changes

All **Critical** and **High Priority** issues from the code review have been addressed:

| Issue | Priority | Status |
|-------|----------|--------|
| 1. `searchQuery` schema/documentation mismatch | 🔴 Critical | ✅ Fixed |
| 2. Type safety gap in markdown handling | 🔴 Critical | ✅ Fixed |
| 3. Silent Qdrant failures | 🔴 Critical | ✅ Fixed |
| 4. Magic numbers in deep crawl config | 🟡 High | ✅ Fixed |
| 5. URL deduplication missing | 🟡 High | ✅ Fixed |
| 6. Timeout values are arbitrary | 🟡 High | ✅ Fixed |
| 7. Character limit is hard-coded | 🟡 High | ✅ Fixed |
| 8. Blocked domains list should be centralized | 🟠 Medium | ✅ Fixed |
| 10. Search query keyword splitting is naive | 🟠 Medium | ✅ Fixed |

---

## Files Changed

| File | Changes |
|------|---------|
| `lib/ai/tools/constants.ts` | **NEW** - Centralized constants for AI tools |
| `lib/ai/tools/crawl-pages.ts` | Updated to use constants, added type guards, deduplication, warnings |
| `lib/ai/tools/find-webpages.ts` | Updated to use centralized constants |

---

## Detailed Changes

### 1. New File: `lib/ai/tools/constants.ts`

Created a new centralized constants file containing:

- **`MAX_RESULT_CHARS = 60_000`** - Maximum characters in crawl results (~15k tokens)
- **`BLOCKED_DOMAINS`** - List of blocked domains (social media, search engines)
- **`BLOCKED_URL_PATTERNS`** - URL patterns to block (login, signup, etc.)
- **`MAX_PAGES_BY_DEPTH`** - Max pages per depth level: `{ 1: 5, 2: 8, 3: 12 }`
- **`BASE_TIMEOUT_MS = 30_000`** - Base timeout per URL in milliseconds
- **`STOPWORDS`** - Set of common English stopwords for keyword filtering
- **`isValidCrawlUrl(url)`** - Utility function to validate crawl URLs
- **`tokenizeQuery(query)`** - Improved query tokenizer that filters stopwords and punctuation

**Benefits:**
- Single source of truth for crawler-related constants
- Easy to tune performance vs. completeness trade-offs
- Reusable across `crawl-pages.ts` and `find-webpages.ts`

---

### 2. Changes to `lib/ai/tools/crawl-pages.ts`

#### 2.1 Added Import for Constants

```typescript
import {
  MAX_RESULT_CHARS,
  MAX_PAGES_BY_DEPTH,
  BASE_TIMEOUT_MS,
  tokenizeQuery,
  isValidCrawlUrl,
} from "./constants";
```

#### 2.2 Added Type Guard for CrawlResultObj (Issue #2)

```typescript
/**
 * Type guard to check if an object is a CrawlResultObj
 */
function isCrawlResultObj(obj: unknown): obj is CrawlResultObj {
  return (
    typeof obj === "object" &&
    obj !== null &&
    ("fit_markdown" in obj || "raw_markdown" in obj)
  );
}
```

**Before:**
```typescript
const processedMarkdown =
  typeof rawMarkdown === "string"
    ? rawMarkdown
    : String(
        (rawMarkdown as CrawlResultObj).fit_markdown ||
          (rawMarkdown as CrawlResultObj).raw_markdown ||
          ""
      );
```

**After:**
```typescript
const processedMarkdown =
  typeof rawMarkdown === "string"
    ? rawMarkdown
    : isCrawlResultObj(rawMarkdown)
      ? String(rawMarkdown.fit_markdown || rawMarkdown.raw_markdown || "")
      : "";
```

---

#### 2.3 URL Deduplication (Issue #5)

**Added:**
```typescript
// Remove duplicate URLs while preserving order
const uniqueUrls = Array.from(new Set(urls));
if (uniqueUrls.length < urls.length) {
  console.log(
    `[CRAWLER] Removed ${urls.length - uniqueUrls.length} duplicate URLs`
  );
}
```

---

#### 2.4 Warning Propagation for Qdrant Failures (Issue #3)

**Added:**
```typescript
// Track warnings for Qdrant failures
const warnings: string[] = [];

// When ensuring collection:
await ensureCollection().catch((err) => {
  console.error("[QDRANT] Failed to ensure collection:", err);
  warnings.push("Qdrant collection not available - RAG disabled");
});

// When ingesting pages:
await ingestPage(url, markdown, searchQuery).catch((err) => {
  console.error(`[QDRANT] Failed to ingest ${url}:`, err);
  warnings.push(`Failed to ingest ${url} into Qdrant`);
});
```

**Return value updated:**
```typescript
return {
  markdown: finalMarkdown,
  urlContents,
  totalCrawled: urlContents.length,
  warnings: warnings.length > 0 ? warnings : undefined,
};
```

---

#### 2.5 Extracted Magic Numbers to Constants (Issues #4, #6, #7)

**Before:**
```typescript
const timeoutMs = depth === 0 ? 30 * 1000 : 60 * 1000;
// ...
max_pages: depth === 1 ? 5 : depth === 2 ? 8 : 12,
// ...
const charLimit = 60_000;
```

**After:**
```typescript
const maxPages = MAX_PAGES_BY_DEPTH[depth as 1 | 2 | 3] ?? 1;
const timeoutMs = depth === 0 ? BASE_TIMEOUT_MS : BASE_TIMEOUT_MS * maxPages;
// ...
max_pages: MAX_PAGES_BY_DEPTH[depth as 1 | 2 | 3] ?? 12,
// ...
if (finalMarkdown.length > MAX_RESULT_CHARS) { ... }
```

---

#### 2.6 Improved Keyword Tokenization (Issue #10)

**Before:**
```typescript
const searchAsKeywords = searchQuery.trim().split(" ");
```

**After:**
```typescript
// Use tokenizeQuery for better keyword extraction (filters stopwords, punctuation)
const searchAsKeywords = tokenizeQuery(searchQuery);
```

---

### 3. Changes to `lib/ai/tools/find-webpages.ts`

#### 3.1 Added Import for Constants

```typescript
import { BLOCKED_DOMAINS, BLOCKED_URL_PATTERNS, isValidCrawlUrl, STOPWORDS } from "./constants";
```

#### 3.2 Replaced Inline Blocked Domains List (Issue #8)

**Before:**
```typescript
function isValidExternalUrl(url: string, _text: string): boolean {
  const blockedDomains = [
    "duckduckgo.com",
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "youtube.com",
    "linkedin.com",
    "reddit.com",
  ];
  // ... 30 more lines of inline validation
}
```

**After:**
```typescript
function isValidExternalUrl(url: string, _text: string): boolean {
  return isValidCrawlUrl(url);
}
```

---

#### 3.3 Improved Keyword Tokenization (Issue #10)

**Before:**
```typescript
const queryTerms = query
  .toLowerCase()
  .split(" ")
  .filter((t) => t.length > 2);
```

**After:**
```typescript
// Use better tokenization that filters stopwords and punctuation
const queryTerms = query
  .toLowerCase()
  .match(/\b[\w']+\b/g)
  ?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? [];
```

---

## Testing Recommendations

After these changes, run the existing unit tests to ensure compatibility:

```bash
cd ai_chatbot
pnpm exec playwright test tests/unit/lib/ai/tools/crawl-pages.test.ts
pnpm exec playwright test tests/unit/lib/ai/tools/find-webpages.test.ts
```

---

## For Future Discussion (Not Addressed)

The following issues from the code review were noted but not addressed in this change set:

- **Issue #11: Test Mocks Could Be DRY** - Extract `mockCrawlResponse` patterns to a `test-helpers.ts` module
- **Prompt Optimization** - The `webSearchPrompt` in `prompts.ts` could be optimized by moving detailed examples to external documentation
- **Integration Testing** - Consider adding E2E tests against the real crawler endpoint

These can be addressed in a follow-up MR.

---

**Changes implemented by:** tsvetomir.mihaylov  
**Date:** 2026-04-02  
**Branch:** split-web-search-tool
