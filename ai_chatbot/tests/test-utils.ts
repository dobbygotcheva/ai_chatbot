import { vi } from "vitest";

/**
 * Stub all required environment variables for config validation
 * Use this in unit tests that import modules requiring config validation
 */
export function stubRequiredEnvVars() {
  vi.stubEnv("POSTGRES_URL", "postgresql://localhost/test");
  vi.stubEnv("PROVIDER_API_KEY", "test-key");
  vi.stubEnv("PROVIDER_BASE_URL", "http://test.com");
  vi.stubEnv("PROVIDER_MODEL", "test-model");
  vi.stubEnv("AUTH_SECRET", "test-secret");
  vi.stubEnv("QDRANT_URL", "http://localhost:6333");
  vi.stubEnv("QDRANT_VECTOR_DIM", "1024");
  vi.stubEnv("QDRANT_EMBEDDING_MODEL", "embedding");
  vi.stubEnv(
    "ENCRYPTION_KEY",
    "a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0"
  );
}
