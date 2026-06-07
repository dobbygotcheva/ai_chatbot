import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/shared/config";

let _dbInstance: ReturnType<typeof drizzle> | null = null;

export function db() {
  if (!_dbInstance) {
    const client = postgres(config.database.url as never);
    _dbInstance = drizzle(client);
  }
  return _dbInstance;
}
