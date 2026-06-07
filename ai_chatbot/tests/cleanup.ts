import { execSync } from "node:child_process";

/**
 * Cleanup script for test database
 *
 * Drops and recreates the test database to ensure clean state.
 * Useful when schema changes or tests leave database in bad state.
 *
 * Usage: pnpm test:clean
 */

const TEST_POSTGRES_URL =
  process.env.POSTGRES_URL ||
  "postgresql://postgres:postgres@localhost:5433/ai_chatbot_test";

console.log("🧹 Cleaning test database...");

try {
  // Extract database name from URL
  const dbName = TEST_POSTGRES_URL.split("/").pop()?.split("?")[0];
  if (!dbName) {
    throw new Error("Could not extract database name from POSTGRES_URL");
  }

  // Extract host from URL for psql connection
  const hostMatch = TEST_POSTGRES_URL.match(/@([^:/]+)/);
  const host = hostMatch ? hostMatch[1] : "localhost";

  console.log(`📦 Dropping database: ${dbName}`);
  execSync(
    `PGPASSWORD=postgres psql -h ${host} -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`,
    {
      stdio: "inherit",
    }
  );

  console.log(`📦 Creating database: ${dbName}`);
  execSync(
    `PGPASSWORD=postgres psql -h ${host} -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
    {
      stdio: "inherit",
    }
  );

  console.log("✅ Database recreated");

  // Run migrations
  console.log("📦 Running migrations...");
  execSync("pnpm db:migrate", {
    stdio: "inherit",
    env: { ...process.env, POSTGRES_URL: TEST_POSTGRES_URL },
  });

  console.log("✅ Test database is clean and ready\n");
  console.log("Run tests with:");
  console.log(`  POSTGRES_URL=${TEST_POSTGRES_URL} pnpm test:unit`);
} catch (error) {
  console.error("❌ Cleanup failed");
  console.error("Make sure the test database container is running:");
  console.error("  docker compose up -d postgres-test");
  throw error;
}
