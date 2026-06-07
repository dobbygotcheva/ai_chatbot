import { randomUUID } from "node:crypto";
import { generateId } from "ai";
import { genSaltSync, hashSync } from "bcrypt-ts";

/** Canonical form for stored and compared emails (trim + lowercase). */
export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateUUID(): string {
  return randomUUID();
}

export function generateHashedPassword(password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  return hash;
}

export function generateDummyPassword() {
  const password = generateId();
  const hashedPassword = generateHashedPassword(password);

  return hashedPassword;
}
