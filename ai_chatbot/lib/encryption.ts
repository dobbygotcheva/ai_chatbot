/**
 * Encryption utilities for sensitive data (API tokens, credentials).
 *
 * - Token hashing: HMAC-SHA256 with raw encryption key (for indexed lookup)
 * - Legacy encryption: AES-256-GCM with scrypt key derivation (for backward compatibility)
 *
 * ⚠️  ENCRYPTION_KEY is REQUIRED - validated at boot time by config schema.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { config } from "@/shared/config";

// Algorithm and key derivation settings
const ALGORITHM = "aes-256-gcm";
const INIT_VECTOR_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for auth tag
const KEY_LENGTH = 32; // 32 bytes for AES-256
const ENCRYPTION_SALT = "server-encryption-salt";

/**
 * Get the raw encryption key for HMAC operations.
 * This is validated at boot time by the config schema (shared/config/index.ts).
 */
export function getEncryptionKey(): string {
  return config.encryption.key;
}

/**
 * Derive a 32-byte key from the encryption password using scrypt
 */
function deriveKey(password: string): Buffer {
  return scryptSync(password, ENCRYPTION_SALT, KEY_LENGTH);
}

/**
 * Cached key to avoid repeated derivation
 */
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = deriveKey(config.encryption.key);
  }
  return cachedKey;
}

/**
 * Encrypt a string value
 * Returns a base64-encoded string containing: initVector + encrypted data + auth tag
 * Returns null for null/undefined/empty values
 * Throws error if ENCRYPTION_KEY is not set
 */
export function encrypt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const key = getKey();

  try {
    const initVector = randomBytes(INIT_VECTOR_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, initVector);

    let encrypted = cipher.update(value, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    // Combine initVector + authTag + encrypted data
    const combined = Buffer.concat([
      initVector,
      Buffer.from(authTag),
      Buffer.from(encrypted, "base64"),
    ]);

    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt sensitive data");
  }
}

/**
 * Decrypt a previously encrypted value
 * Returns null for null/undefined/empty values
 */
export function decrypt(
  encryptedValue: string | null | undefined
): string | null {
  if (!encryptedValue) {
    return null;
  }

  const key = getKey();

  try {
    const combined = Buffer.from(encryptedValue, "base64");

    // Extract components
    const initVector = combined.slice(0, INIT_VECTOR_LENGTH);
    const authTag = combined.slice(
      INIT_VECTOR_LENGTH,
      INIT_VECTOR_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.slice(INIT_VECTOR_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, initVector);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt sensitive data");
  }
}
