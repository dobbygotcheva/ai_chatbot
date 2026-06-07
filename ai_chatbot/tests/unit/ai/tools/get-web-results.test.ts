import { describe, expect, it } from "vitest";

import {
  calculateUrlScore,
  DOMAIN_TIERS,
  extractUrlsFromSearch,
  isValidExternalUrl,
  TIER_SCORES,
} from "@/lib/ai/tools/get-web-results";

describe("get-web-results", () => {
  describe("isValidExternalUrl", () => {
    it("accepts valid HTTP/HTTPS URLs", () => {
      expect(isValidExternalUrl("https://example.com", "Example")).toBe(true);
      expect(
        isValidExternalUrl("http://example.com/page", "Example Page")
      ).toBe(true);
    });

    it("rejects non-HTTP URLs", () => {
      expect(isValidExternalUrl("ftp://example.com", "FTP")).toBe(false);
      expect(isValidExternalUrl("javascript:void(0)", "JS")).toBe(false);
      expect(isValidExternalUrl("mailto:test@example.com", "Email")).toBe(
        false
      );
    });

    it("rejects blocked domains", () => {
      expect(isValidExternalUrl("https://duckduckgo.com/search", "DDG")).toBe(
        false
      );
      expect(isValidExternalUrl("https://facebook.com/page", "FB")).toBe(false);
      expect(isValidExternalUrl("https://twitter.com/user", "Twitter")).toBe(
        false
      );
      expect(
        isValidExternalUrl("https://instagram.com/user", "Instagram")
      ).toBe(false);
      expect(isValidExternalUrl("https://youtube.com/watch", "YouTube")).toBe(
        false
      );
      expect(
        isValidExternalUrl("https://linkedin.com/in/user", "LinkedIn")
      ).toBe(false);
      expect(isValidExternalUrl("https://reddit.com/r/test", "Reddit")).toBe(
        false
      );
    });

    it("accepts valid URLs regardless of text content", () => {
      // The function doesn't check text content for http anymore
      expect(
        isValidExternalUrl("https://example.com", "Visit http://example.com")
      ).toBe(true);
    });

    it("accepts authoritative domains", () => {
      expect(
        isValidExternalUrl("https://www.bbc.co.uk/sport", "BBC Sport")
      ).toBe(true);
      expect(
        isValidExternalUrl("https://www.premierleague.com", "Premier League")
      ).toBe(true);
      expect(
        isValidExternalUrl("https://en.wikipedia.org/wiki/Test", "Wikipedia")
      ).toBe(true);
    });
  });

  describe("calculateUrlScore", () => {
    const queryTerms = ["arsenal", "fixtures", "2026"];

    // Helper to get tier score from array-based TIER_SCORES
    const getTierScore = (tierName: string): number => {
      const tier = TIER_SCORES.find((t) => t.tier === tierName);
      if (!tier) {
        throw new Error(`Unknown tier: ${tierName}`);
      }
      return tier.score;
    };

    describe("Tier 1: Government/Education domains", () => {
      it.each(
        DOMAIN_TIERS.GOVERNMENT_EDUCATION.map((d) => [
          d,
          `https://www.example${d}/page`,
        ])
      )("should score +%d for domain suffix: %s", (_suffix, url) => {
        const score = calculateUrlScore(url, "Test", queryTerms);
        expect(score).toBeGreaterThanOrEqual(
          getTierScore("GOVERNMENT_EDUCATION")
        );
      });
    });

    describe("Tier 2: Academic/Reference domains", () => {
      it.each(
        DOMAIN_TIERS.ACADEMIC_REFERENCE.map((d) => [
          d,
          `https://www.${d}/article`,
        ])
      )("should score +%d for domain: %s", (_domain, url) => {
        const score = calculateUrlScore(url, "Test", queryTerms);
        expect(score).toBeGreaterThanOrEqual(
          getTierScore("ACADEMIC_REFERENCE")
        );
      });
    });

    describe("Tier 3: News sources", () => {
      it.each(
        DOMAIN_TIERS.NEWS_SOURCES.map((d) => [d, `https://www.${d}/article`])
      )("should score +%d for domain: %s", (_domain, url) => {
        const score = calculateUrlScore(url, "Test", queryTerms);
        expect(score).toBeGreaterThanOrEqual(getTierScore("NEWS_SOURCES"));
      });
    });

    describe("Tier 4: Technical documentation", () => {
      it.each(
        DOMAIN_TIERS.TECHNICAL_DOCS.map((d) => [d, `https://www.${d}/docs`])
      )("should score +%d for domain: %s", (_domain, url) => {
        const score = calculateUrlScore(url, "Test", queryTerms);
        expect(score).toBeGreaterThanOrEqual(getTierScore("TECHNICAL_DOCS"));
      });
    });

    describe("relevance scoring", () => {
      it("should score higher when title contains all query terms", () => {
        const highScore = calculateUrlScore(
          "https://example.com",
          "Arsenal fixtures 2026 schedule",
          queryTerms
        );
        const lowScore = calculateUrlScore(
          "https://example.com",
          "Random sports news",
          queryTerms
        );
        expect(highScore).toBeGreaterThan(lowScore);
      });

      it("should score higher when URL path contains query terms", () => {
        const highScore = calculateUrlScore(
          "https://example.com/arsenal/fixtures/2026",
          "Sports",
          queryTerms
        );
        const lowScore = calculateUrlScore(
          "https://example.com/random/page",
          "Sports",
          queryTerms
        );
        expect(highScore).toBeGreaterThan(lowScore);
      });
    });

    describe("freshness scoring", () => {
      it("should boost recent content", () => {
        const freshScore = calculateUrlScore(
          "https://example.com",
          "Arsenal fixtures 2026 latest today",
          queryTerms
        );
        const oldScore = calculateUrlScore(
          "https://example.com",
          "Arsenal fixtures historical",
          queryTerms
        );
        expect(freshScore).toBeGreaterThan(oldScore);
      });

      it("should boost content with current year", () => {
        const currentYear = new Date().getFullYear();
        const yearScore = calculateUrlScore(
          "https://example.com",
          `Arsenal fixtures ${currentYear}`,
          queryTerms
        );
        const noYearScore = calculateUrlScore(
          "https://example.com",
          "Arsenal fixtures",
          queryTerms
        );
        expect(yearScore).toBeGreaterThan(noYearScore);
      });
    });

    describe("quality signals", () => {
      it("should prefer HTTPS over HTTP", () => {
        const httpsScore = calculateUrlScore(
          "https://example.com",
          "Sports",
          queryTerms
        );
        const httpScore = calculateUrlScore(
          "http://example.com",
          "Sports",
          queryTerms
        );
        expect(httpsScore).toBeGreaterThan(httpScore);
      });

      it("should penalize very long URLs", () => {
        const shortUrl = "https://example.com/sport";
        const longUrl = `https://example.com/${"a".repeat(150)}/sport`;
        const shortScore = calculateUrlScore(shortUrl, "Sports", queryTerms);
        const longScore = calculateUrlScore(longUrl, "Sports", queryTerms);
        expect(shortScore).toBeGreaterThan(longScore);
      });
    });

    describe("tier hierarchy", () => {
      it("should score Tier 1 > Tier 2 > Tier 3 > Tier 4", () => {
        const tier1Score = calculateUrlScore(
          `https://www.example${DOMAIN_TIERS.GOVERNMENT_EDUCATION[0]}/test`,
          "Test",
          queryTerms
        );
        const tier2Score = calculateUrlScore(
          `https://www.${DOMAIN_TIERS.ACADEMIC_REFERENCE[0]}/test`,
          "Test",
          queryTerms
        );
        const tier3Score = calculateUrlScore(
          `https://www.${DOMAIN_TIERS.NEWS_SOURCES[0]}/test`,
          "Test",
          queryTerms
        );
        const tier4Score = calculateUrlScore(
          `https://www.${DOMAIN_TIERS.TECHNICAL_DOCS[0]}/test`,
          "Test",
          queryTerms
        );
        const noTierScore = calculateUrlScore(
          "https://random-site.com/test",
          "Test",
          queryTerms
        );

        expect(tier1Score).toBeGreaterThan(tier2Score);
        expect(tier2Score).toBeGreaterThan(tier3Score);
        expect(tier3Score).toBeGreaterThan(tier4Score);
        expect(tier4Score).toBeGreaterThanOrEqual(noTierScore);
      });

      it("should verify tier scores match constants", () => {
        // Convert array-based TIER_SCORES to map for easy lookup
        const scoreMap = Object.fromEntries(
          TIER_SCORES.map(({ tier, score }) => [tier, score])
        );

        expect(
          calculateUrlScore(
            `http://www.example${DOMAIN_TIERS.GOVERNMENT_EDUCATION[0]}/test`,
            "Test",
            []
          )
        ).toBe(scoreMap.GOVERNMENT_EDUCATION);

        expect(
          calculateUrlScore(
            `http://www.${DOMAIN_TIERS.ACADEMIC_REFERENCE[0]}/test`,
            "Test",
            []
          )
        ).toBe(scoreMap.ACADEMIC_REFERENCE);

        expect(
          calculateUrlScore(
            `http://www.${DOMAIN_TIERS.NEWS_SOURCES[0]}/test`,
            "Test",
            []
          )
        ).toBe(scoreMap.NEWS_SOURCES);

        expect(
          calculateUrlScore(
            `http://www.${DOMAIN_TIERS.TECHNICAL_DOCS[0]}/test`,
            "Test",
            []
          )
        ).toBe(scoreMap.TECHNICAL_DOCS);
      });
    });
  });

  describe("extractUrlsFromSearch", () => {
    it("extracts URLs from markdown format", () => {
      const markdown = `
        # Search Results
        [Arsenal Fixtures 2026](https://www.premierleague.com/fixtures)
        [BBC Sport Arsenal](https://www.bbc.co.uk/sport/arsenal)
      `;
      const html = "";
      const urls = extractUrlsFromSearch(markdown, html);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.some((u) => u.url.includes("premierleague.com"))).toBe(true);
      expect(urls.some((u) => u.url.includes("bbc.co.uk"))).toBe(true);
    });

    it("extracts URLs from HTML when markdown is insufficient", () => {
      const markdown = "";
      const html = `
        <a href="https://www.espn.com/soccer/arsenal">ESPN Arsenal</a>
        <a href="https://www.goal.com/arsenal">Goal.com Arsenal</a>
      `;
      const urls = extractUrlsFromSearch(markdown, html);
      expect(urls.length).toBeGreaterThan(0);
    });

    it("filters out blocked domains", () => {
      const markdown = `
        [Premier League](https://www.premierleague.com)
        [Facebook Page](https://www.facebook.com/arsenal)
        [Twitter](https://twitter.com/arsenal)
      `;
      const html = "";
      const urls = extractUrlsFromSearch(markdown, html);
      expect(urls.some((u) => u.url.includes("facebook.com"))).toBe(false);
      expect(urls.some((u) => u.url.includes("twitter.com"))).toBe(false);
      expect(urls.some((u) => u.url.includes("premierleague.com"))).toBe(true);
    });

    it("returns URLs with titles", () => {
      const markdown = "[Arsenal FC](https://www.arsenal.com)";
      const html = "";
      const urls = extractUrlsFromSearch(markdown, html);
      expect(urls[0]).toHaveProperty("url");
      expect(urls[0]).toHaveProperty("title");
      expect(urls[0].title).toBe("Arsenal FC");
    });
  });
});
