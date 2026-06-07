import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseDotenv } from "dotenv";

function isPsqlAvailable(): boolean {
  const probe = spawnSync("psql", ["--version"], { stdio: "ignore" });
  return probe.status === 0;
}

/**
 * Ensure the test database exists using a direct `postgres` connection.
 * Falls back from psql when the binary is not installed on the host
 * (common on slim WSL / container setups).
 */
async function ensureTestDatabaseViaPostgresJs(
  targetUrl: string,
  dbName: string
): Promise<void> {
  const adminUrl = new URL(targetUrl);
  adminUrl.pathname = "/postgres";

  const postgres = (await import("postgres")).default;
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const rows = await admin<{ exists: number }[]>`
      SELECT 1 AS exists FROM pg_database WHERE datname = ${dbName}
    `;
    if (rows.length > 0) {
      console.log(`✅ Database ${dbName} already exists`);
      return;
    }
    console.log(`📦 Creating database: ${dbName}`);
    // Database names can't be parameterized, so quote via unsafe().
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

/**
 * Vitest Global Setup for Integration Tests
 *
 * This script:
 * 1. Loads .env.local (local development)
 * 2. Sets POSTGRES_URL to test database (if not already set in CI)
 * 3. Runs database migrations
 * 4. Cleans up on exit
 *
 * In CI: Uses existing POSTGRES_URL from gitlab-ci.yml
 * Locally: Loads .env.local and uses test database (ai_chatbot_test)
 */

// Load .env.local in local development
const isCI = process.env.CI === "true" || process.env.GITLAB_CI === "true";

if (!isCI) {
  const envLocalPath = resolve(process.cwd(), ".env.local");
  try {
    const envLocalContent = readFileSync(envLocalPath, "utf-8");
    const parsed = parseDotenv(envLocalContent);
    // Merge with process.env (existing env vars take precedence)
    for (const key of Object.keys(parsed)) {
      if (!process.env[key]) {
        process.env[key] = parsed[key];
      }
    }
    console.log("📄 Loaded .env.local");
  } catch {
    console.log("⚠️  .env.local not found, using environment variables");
  }
}

// Use test database (ai_chatbot_test) instead of dev database
function getTestDatabaseUrl(devUrl: string | undefined): string {
  if (!devUrl) {
    return "postgresql://postgres:postgres@localhost:5433/ai_chatbot_test";
  }
  // Replace database name with test database
  try {
    const url = new URL(devUrl);
    url.pathname = "/ai_chatbot_test";
    return url.toString();
  } catch {
    // If URL parsing fails, try string replacement
    return devUrl.replace(/\/[^/]+$/, "/ai_chatbot_test");
  }
}

const TEST_POSTGRES_URL = getTestDatabaseUrl(process.env.POSTGRES_URL);

export default async function setup() {
  console.log("🔧 Setting up test environment...");

  // In CI, POSTGRES_URL is already set correctly by gitlab-ci.yml
  // The postgres service creates the database via POSTGRES_DB env var
  if (isCI) {
    console.log("🏃 Running in CI, using provided POSTGRES_URL");
    console.log("📦 Using database from POSTGRES_URL");
  } else {
    // Locally, use test database (ai_chatbot_test)
    console.log(`📦 Using test database: ${TEST_POSTGRES_URL}`);
    process.env.POSTGRES_URL = TEST_POSTGRES_URL;

    // Create database if it doesn't exist (local only)
    const urlParts = (process.env.POSTGRES_URL || "").split("/");
    const dbName = urlParts.pop()?.split("?")[0] || "ai_chatbot_test";

    try {
      console.log("⏳ Checking if test database exists...");
      if (isPsqlAvailable()) {
        const dbCheck = execSync(
          `PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='${dbName}';"`,
          {
            encoding: "utf8",
          }
        ).trim();

        if (dbCheck) {
          console.log(`✅ Database ${dbName} already exists`);
        } else {
          console.log(`📦 Creating database: ${dbName}`);
          execSync(
            `PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
            {
              stdio: "inherit",
            }
          );
        }
      } else {
        console.log("ℹ️  psql not found on host, using postgres.js fallback");
        await ensureTestDatabaseViaPostgresJs(
          process.env.POSTGRES_URL ?? "",
          dbName
        );
      }
    } catch (error) {
      console.error("❌ Failed to check/create database");
      console.error(
        "   Make sure postgres is running: docker compose up -d postgres"
      );
      throw error;
    }
  }

  // Check if database is accessible
  try {
    console.log("⏳ Checking database connection...");
    execSync(
      "node -e \"require('postgres')(process.env.POSTGRES_URL).end()\"",
      {
        stdio: "pipe",
        env: { ...process.env, POSTGRES_URL: process.env.POSTGRES_URL },
      }
    );
    console.log("✅ Database connection successful");
  } catch {
    console.error("❌ Cannot connect to test database");
    throw new Error("Test database connection failed");
  }

  // Run migrations
  try {
    console.log("📦 Running database migrations...");
    execSync("pnpm db:migrate", {
      stdio: "inherit",
      env: { ...process.env, POSTGRES_URL: process.env.POSTGRES_URL },
    });
    console.log("✅ Migrations complete");
  } catch (error) {
    console.error("❌ Migration failed");
    throw error;
  }

  console.log("✅ Test environment ready\n");
}
