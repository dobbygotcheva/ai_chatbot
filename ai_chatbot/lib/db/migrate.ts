import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { parsePgUrl } from "./connection";

// Load environment variables from .env.local if it exists (development only)
// In production, environment variables are set by the runtime (Docker, CI/CD, etc.)
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}

const databaseUrl = process.env.POSTGRES_URL;

async function runMigrate() {
  if (!databaseUrl) {
    console.log("⏭️  POSTGRES_URL not defined, skipping migrations");
    process.exit(0);
  }

  const parsed = parsePgUrl(databaseUrl);
  const connection =
    typeof parsed === "string"
      ? postgres(parsed, { max: 1 })
      : // biome-ignore lint/suspicious/noExplicitAny: postgres type inference limitation
        postgres(parsed as any);
  const db = drizzle(connection);

  console.log("⏳ Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
  process.exit(0);
}

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
