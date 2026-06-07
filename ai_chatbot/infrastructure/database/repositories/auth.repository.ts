// Auth Repository Implementation - Infrastructure layer
// Implements AuthRepositoryPort using Drizzle ORM

import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { AuthRepositoryPort } from "../../../core/auth/auth.repository.port";
import type * as schema from "../../../lib/db/schema";
import { type User, user } from "../../../lib/db/schema";
import { normalizeUserEmail } from "../../../lib/db/utils";

export class AuthRepository implements AuthRepositoryPort {
  // biome-ignore lint/style/noParameterProperties: Constructor property promotion is standard for dependency injection
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findUserById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const normalized = normalizeUserEmail(email);
    const result = await this.db
      .select()
      .from(user)
      .where(sql`lower(${user.email}) = ${normalized}`)
      .limit(1);
    return result[0] ?? null;
  }

  async createUser(data: { email: string }): Promise<User> {
    const result = await this.db
      .insert(user)
      .values({
        ...data,
        email: normalizeUserEmail(data.email),
      } as typeof user.$inferInsert)
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: Database insert always returns the inserted row
    return result[0]!;
  }

  async updateUser(
    id: string,
    data: Partial<Pick<User, "email">>
  ): Promise<User | null> {
    const payload =
      data.email === undefined
        ? data
        : { ...data, email: normalizeUserEmail(data.email) };
    const result = await this.db
      .update(user)
      .set(payload as Partial<typeof user.$inferSelect>)
      .where(eq(user.id, id))
      .returning();
    return result[0] ?? null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db
      .delete(user)
      .where(eq(user.id, id))
      .returning();
    return result.length > 0;
  }
}
