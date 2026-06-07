/**
 * Unit tests for the centralized configuration module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubRequiredEnvVars } from "@/tests/test-utils";

describe("Config", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    consoleErrorSpy?.mockRestore();
    processExitSpy?.mockRestore();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  describe("Required environment variables", () => {
    it("should load config with all required variables", async () => {
      stubRequiredEnvVars();

      const { config } = await import("../../../shared/config");

      expect(config.database.url).toBe("postgresql://localhost/test");
      expect(config.ai.providerApiKey).toBe("test-key");
      expect(config.ai.providerBaseUrl).toBe("http://test.com");
      expect(config.ai.providerModel).toBe("test-model");
      expect(config.auth.secret).toBe("test-secret");
      expect(config.vector.url).toBe("http://localhost:6333");
      expect(config.vector.dimensions).toBe(1024);
      expect(config.vector.embeddingModel).toBe("embedding");
      expect(config.encryption.key).toBe(
        "a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0"
      );
    });

    const requiredVars = [
      "POSTGRES_URL",
      "PROVIDER_API_KEY",
      "PROVIDER_BASE_URL",
      "PROVIDER_MODEL",
      "AUTH_SECRET",
      "QDRANT_URL",
      "ENCRYPTION_KEY",
    ] as const;

    const setupEnv = (missingVar: string) => {
      stubRequiredEnvVars();
      delete process.env[missingVar];
    };

    it.each(
      requiredVars
    )("should fail validation when $missingVar is missing", async (missingVar) => {
      setupEnv(missingVar);

      // Empty implementation intentionally - mocking silent error logging
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      await expect(async () => {
        vi.resetModules();
        const { config } = await import("../../../shared/config");
        // Access a property to trigger lazy loading and validation
        config.database.url;
      }).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("Immutability", () => {
    beforeEach(() => {
      stubRequiredEnvVars();
    });

    it("should freeze the config object", async () => {
      const { config } = await import("../../../shared/config");
      // Trigger lazy loading by accessing a property
      const originalUrl = config.database.url;

      // Attempt to mutate the config state
      // This should throw TypeError because the config is frozen
      expect(() => {
        (config as any).database = { url: "postgresql://modified/test" };
      }).toThrow(TypeError);

      // Verify the mutation had no effect (config is frozen)
      expect(config.database.url).toBe(originalUrl);
    });
  });

  describe("AUTH_EMAIL_GROUPS", () => {
    const baseEnv = {
      POSTGRES_URL: "postgresql://localhost/test",
      PROVIDER_API_KEY: "test-key",
      PROVIDER_BASE_URL: "http://test.com",
      PROVIDER_MODEL: "test-model",
      AUTH_SECRET: "test-secret",
      QDRANT_URL: "http://localhost:6333",
      QDRANT_VECTOR_DIM: "1024",
      QDRANT_EMBEDDING_MODEL: "embedding",
      ENCRYPTION_KEY:
        "a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    };

    beforeEach(() => {
      vi.unstubAllEnvs();
      for (const [key, value] of Object.entries(baseEnv)) {
        vi.stubEnv(key, value);
      }
      vi.resetModules();
    });

    it("should parse single email with single group", async () => {
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-USERS"
      );

      const { config } = await import("../../../shared/config");
      expect(config.auth.emailGroups).toEqual({
        "admin@example.com": ["SG-EGT-AI-CENTER-USERS"],
      });
    });

    it("should parse single email with multiple groups", async () => {
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-USERS|SG-EGT-AI-CENTER-ADMIN-TEMPORARY"
      );

      const { config } = await import("../../../shared/config");
      expect(config.auth.emailGroups).toEqual({
        "admin@example.com": [
          "SG-EGT-AI-CENTER-USERS",
          "SG-EGT-AI-CENTER-ADMIN-TEMPORARY",
        ],
      });
    });

    it("should parse multiple emails", async () => {
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-USERS;dev@example.com=SG-EGT-AI-CENTER-TEST-USERS"
      );

      const { config } = await import("../../../shared/config");
      expect(config.auth.emailGroups).toEqual({
        "admin@example.com": ["SG-EGT-AI-CENTER-USERS"],
        "dev@example.com": ["SG-EGT-AI-CENTER-TEST-USERS"],
      });
    });

    it("should accumulate groups for same email", async () => {
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-USERS;admin@example.com=SG-EGT-AI-CENTER-ADMIN-TEMPORARY"
      );

      const { config } = await import("../../../shared/config");
      expect(config.auth.emailGroups).toEqual({
        "admin@example.com": [
          "SG-EGT-AI-CENTER-USERS",
          "SG-EGT-AI-CENTER-ADMIN-TEMPORARY",
        ],
      });
    });

    it("should fail validation when invalid groups are found", async () => {
      vi.stubEnv("AUTH_EMAIL_GROUPS", "admin@example.com=INVALID_GROUP");

      await expect(async () => {
        vi.resetModules();
        const { config } = await import("../../../shared/config");
        config.auth.emailGroups;
      }).rejects.toThrow("AUTH_EMAIL_GROUPS validation failed");
    });

    it("should fail validation when invalid format is found", async () => {
      vi.stubEnv("AUTH_EMAIL_GROUPS", "invalid-format-without-equals");

      await expect(async () => {
        vi.resetModules();
        const { config } = await import("../../../shared/config");
        config.auth.emailGroups;
      }).rejects.toThrow("Invalid format");
    });

    it("should fail validation when entry has no equals sign", async () => {
      vi.stubEnv("AUTH_EMAIL_GROUPS", "admin@example.com");

      await expect(async () => {
        vi.resetModules();
        const { config } = await import("../../../shared/config");
        config.auth.emailGroups;
      }).rejects.toThrow("Invalid format");
    });

    it("should fail validation when entry has empty groups", async () => {
      vi.stubEnv("AUTH_EMAIL_GROUPS", "admin@example.com=");

      await expect(async () => {
        vi.resetModules();
        const { config } = await import("../../../shared/config");
        config.auth.emailGroups;
      }).rejects.toThrow("Invalid format");
    });

    it("should return empty object when AUTH_EMAIL_GROUPS is not set", async () => {
      delete process.env.AUTH_EMAIL_GROUPS;

      const { config } = await import("../../../shared/config");
      expect(config.auth.emailGroups).toEqual({});
    });

    it("should return empty object when AUTH_EMAIL_GROUPS is empty string", async () => {
      vi.stubEnv("AUTH_EMAIL_GROUPS", "");

      const { config } = await import("../../../shared/config");
      expect(config.auth.emailGroups).toEqual({});
    });

    it("should allow empty groups between pipes", async () => {
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-USERS||SG-EGT-AI-CENTER-ADMIN-TEMPORARY"
      );

      const { config } = await import("../../../shared/config");
      expect(config.auth.emailGroups).toEqual({
        "admin@example.com": [
          "SG-EGT-AI-CENTER-USERS",
          "SG-EGT-AI-CENTER-ADMIN-TEMPORARY",
        ],
      });
    });

    it("should fail validation when all groups are invalid", async () => {
      vi.stubEnv("AUTH_EMAIL_GROUPS", "admin@example.com=INVALID1|INVALID2");

      await expect(async () => {
        vi.resetModules();
        const { config } = await import("../../../shared/config");
        config.auth.emailGroups;
      }).rejects.toThrow("AUTH_EMAIL_GROUPS validation failed");
    });

    it("should fail validation when any group is invalid in complex scenario", async () => {
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-USERS|INVALID_GROUP;dev@example.com=SG-EGT-AI-CENTER-TEST-USERS"
      );

      await expect(async () => {
        vi.resetModules();
        const { config } = await import("../../../shared/config");
        config.auth.emailGroups;
      }).rejects.toThrow("AUTH_EMAIL_GROUPS validation failed");
    });
  });
});
