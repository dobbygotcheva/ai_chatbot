// Auth Repository Port - Core layer
// Defines auth domain database operations
// Infrastructure implements this using Drizzle

import type { User } from "../../lib/db/schema";

export interface AuthRepositoryPort {
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  createUser(data: { email: string }): Promise<User>;
  updateUser(
    id: string,
    data: Partial<Pick<User, "email">>
  ): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;
}
