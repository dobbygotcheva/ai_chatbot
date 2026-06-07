// Centralized constants for AI tools

/**
 * Maximum characters allowed in crawl results
 * ~60k characters ≈ 15k tokens (4 chars/token average)
 * Leaves room for system prompt + conversation history in 200k context
 */
export const MAX_RESULT_CHARS = 60_000;

/**
 * Domains blocked from crawling
 * Includes social media, search engines, and utility pages
 */
export const BLOCKED_DOMAINS = [
  "duckduckgo.com",
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "linkedin.com",
  "reddit.com",
] as const;

/**
 * URL patterns blocked from crawling (login/signup pages, etc.)
 */
export const BLOCKED_URL_PATTERNS = [
  "/login",
  "/signup",
  "/register",
  "/account",
  "about:",
  "javascript:",
  "mailto:",
] as const;

/**
 * Maximum pages to crawl per URL at each depth level
 * Tuned for: depth 1 = quick overview, depth 2 = moderate research, depth 3 = comprehensive
 */
export const MAX_PAGES_BY_DEPTH = { 1: 5, 2: 8, 3: 12 } as const;

/**
 * Base timeout per URL in milliseconds
 * Scaled by depth for deeper crawls
 */
export const BASE_TIMEOUT_MS = 30_000;

/**
 * Stopwords for keyword tokenization
 */
export const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "dare",
  "ought",
  "used",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "as",
  "if",
  "then",
  "else",
  "because",
  "while",
  "although",
  "though",
  "after",
  "before",
  "until",
  "since",
  "unless",
  "once",
  "whether",
  "about",
  "into",
  "through",
  "during",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "here",
  "there",
  "any",
]);

/**
 * Domain authority tiers for URL scoring
 * Higher tiers indicate more authoritative/trustworthy sources
 */
export const DOMAIN_TIERS = {
  /** Tier 1: Government and educational institutions (+5 points) */
  GOVERNMENT_EDUCATION: [
    ".gov",
    ".edu",
    ".gov.uk",
    ".ac.uk",
    "government.bg",
    "parliament.bg",
    "president.bg",
  ],

  /** Tier 2: Academic and reference sources (+4 points) */
  ACADEMIC_REFERENCE: [
    "wikipedia.org",
    "britannica.com",
    "arxiv.org",
    "ar5iv.org",
    "pubmed.gov",
    "sciencedirect.com",
    "jstor.org",
    "nature.com",
    "science.org",
    "ieee.org",
  ],

  /** Tier 3: News sources and fact-checkers (+3 points) */
  NEWS_SOURCES: [
    "reuters.com",
    "apnews.com",
    "bloomberg.com",
    "wsj.com",
    "ft.com",
    "economist.com",
    "nytimes.com",
    "washingtonpost.com",
    "npr.org",
    "axios.com",
    "theguardian.com",
    "bbc.co.uk",
    "bbc.com",
    "aljazeera.com",
    "dw.com",
    "scmp.com",
    "snopes.com",
    "factcheck.org",
    "politifact.com",
    "fullfact.org",
    "dnevnik.bg",
    "mediapool.bg",
    "bnr.bg",
    "bnt.bg",
    "capital.bg",
  ],

  /** Tier 4: Technical documentation (+2 points) */
  TECHNICAL_DOCS: [
    "stackoverflow.com",
    "developer.mozilla.org",
    "mdn.mozilla.org",
    "docs.python.org",
    "react.dev",
    "aws.amazon.com",
    "cloud.google.com",
    "learn.microsoft.com",
    "developer.apple.com",
    "developers.google.com",
    "typescriptlang.org",
    "nodejs.org",
    "docs.docker.com",
    "kubernetes.io",
    "doc.rust-lang.org",
    "go.dev",
  ],
} as const;

export const TIER_SCORES = [
  { tier: "GOVERNMENT_EDUCATION", score: 5 },
  { tier: "ACADEMIC_REFERENCE", score: 4 },
  { tier: "NEWS_SOURCES", score: 3 },
  { tier: "TECHNICAL_DOCS", score: 2 },
] as const;

/**
 * Calculate domain authority score for a URL
 * Returns the highest matching tier score (first match wins)
 */
export function calculateDomainAuthority(url: string): number {
  const domain = new URL(url).hostname.toLowerCase();

  const matchedTier = TIER_SCORES.find(({ tier }) =>
    DOMAIN_TIERS[tier].some((d) => domain.includes(d))
  );

  return matchedTier?.score ?? 0;
}

/**
 * Check if a URL is valid for crawling
 */
export function isValidCrawlUrl(url: string): boolean {
  if (!url.startsWith("http")) {
    return false;
  }
  const lowerUrl = url.toLowerCase();
  if (BLOCKED_DOMAINS.some((d) => lowerUrl.includes(d))) {
    return false;
  }
  if (BLOCKED_URL_PATTERNS.some((p) => lowerUrl.includes(p))) {
    return false;
  }
  return true;
}

/**
 * Tokenize a search query into keywords, filtering out stopwords and punctuation
 */
export function tokenizeQuery(query: string): string[] {
  return (
    query
      .toLowerCase()
      .match(/\b[\w']+\b/g)
      ?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? []
  );
}
