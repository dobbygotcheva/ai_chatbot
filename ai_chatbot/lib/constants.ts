import { config } from "@/shared/config";
import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = () => config.app.isProduction;
export const isDevelopmentEnvironment = () => config.app.isDevelopment;
export const isTestEnvironment = () =>
  Boolean(
    config.test.playwrightTestBaseUrl ||
      config.test.playwright ||
      config.test.ciPlaywright
  );

/** Must match `cookies.sessionToken.name` in `app/(auth)/auth.ts`. */
export const NEXT_AUTH_SESSION_COOKIE_NAME = "next-auth.session-token" as const;

export function getDummyPassword() {
  return generateDummyPassword();
}

/**
 * Maximum input tokens for the context window.
 * Used to calculate the context usage percentage.
 */
export const CONTEXT_WINDOW_INPUT = 230_000;

/**
 * Approximate token overhead from the system prompt and framing.
 * Added to the character-based estimate when real usage is unavailable.
 */
export const SYSTEM_OVERHEAD_TOKENS = 1200;

/**
 * One day in milliseconds.
 * Used for token expiry calculations and other time-based operations.
 */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const ONE_HOUR_MS = 60 * 60 * 1000;
