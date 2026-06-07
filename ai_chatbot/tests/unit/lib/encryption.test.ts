import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the config with a test encryption key
vi.mock("@/shared/config", () => {
  const testKey = randomBytes(32).toString("hex");

  return {
    config: {
      encryption: {
        key: testKey,
      },
    },
  };
});

import { decrypt, encrypt } from "@/lib/encryption";

/**
 * Generate a secure random encryption key
 */
function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

describe("Encryption", () => {
  beforeEach(() => {
    // Clear module cache to reload config
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("encrypt / decrypt", () => {
    it("should encrypt and decrypt a value", () => {
      const original = "my-secret-token";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(original);
      expect(decrypted).toBe(original);
    });

    it("should return different encrypted values for same input", () => {
      const value = "test-token";
      const encrypted1 = encrypt(value);
      const encrypted2 = encrypt(value);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(value);
      expect(decrypt(encrypted2)).toBe(value);
    });

    it("should handle empty string", () => {
      const encrypted = encrypt("");
      expect(decrypt(encrypted)).toBe(null);
    });

    it("should return null for null input", () => {
      expect(encrypt(null)).toBe(null);
      expect(decrypt(null)).toBe(null);
    });

    it("should return null for undefined input", () => {
      expect(encrypt(undefined)).toBe(null);
      expect(decrypt(undefined)).toBe(null);
    });
  });

  describe("generateEncryptionKey", () => {
    it("should generate a 64-character hex string", () => {
      const key = generateEncryptionKey();

      expect(key).toMatch(/^[0-9a-f]{64}$/i);
    });

    it("should generate unique keys", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });
});
