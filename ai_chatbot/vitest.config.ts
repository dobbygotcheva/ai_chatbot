import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "**/*.config.*",
        "**/.next/**",
        "**/*.d.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/unit/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          exclude: [
            "tests/e2e/**",
            "tests/integration/**",
            "node_modules/**",
            ".next/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          globalSetup: ["./tests/setup.ts"],
          include: ["tests/integration/**/*.test.{ts,tsx}"],
          exclude: [
            "tests/e2e/**",
            "tests/unit/**",
            "node_modules/**",
            ".next/**",
          ],
        },
      },
    ],
  },
});
