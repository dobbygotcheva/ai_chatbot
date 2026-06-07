// Database Port - Shared layer
// Defines database operations that core needs
// Infrastructure implements this using Drizzle

export interface DatabasePort {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  findById<T>(table: string, id: string): Promise<T | null>;
  findMany<T>(table: string, where: Record<string, unknown>): Promise<T[]>;
}
