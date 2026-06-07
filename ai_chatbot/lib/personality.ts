/**
 * Chatbot personality definitions — the single source of truth for all
 * personality-related data consumed across the app.
 *
 * Design rationale
 * ────────────────
 * Personality is stored as a browser cookie rather than in the database.
 *
 *  • Zero latency: the preference is available on the first request without a
 *    DB round-trip, which matters because the system prompt is assembled
 *    synchronously at the start of each streaming response.
 *
 *  • No schema migration: adding or renaming a personality only requires
 *    changing this file, not altering a DB table and running a migration.
 *
 *  • Privacy-by-default: a cosmetic user preference does not need to be stored
 *    server-side and associated with an account.
 *
 * All three data shapes (options list, type, prompt map) are derived from the
 * same `PERSONALITY_OPTIONS` constant so they are always in sync — adding a
 * new option automatically makes it available in the type, the selector UI,
 * and the prompt map (TypeScript will enforce that the map entry exists).
 */

/** Cookie name used to persist the user's personality choice across sessions. */
export const PERSONALITY_COOKIE = "ai-personality";

/**
 * Ordered list of available personalities.
 *
 * `as const` makes every `value` a string literal type, which lets TypeScript
 * derive the `Personality` union type automatically.  This prevents the
 * settings UI and the prompt map from drifting out of sync — any value added
 * here must also appear in `PERSONALITY_PROMPTS` or the compiler will error.
 */
export const PERSONALITY_OPTIONS = [
  {
    value: "default",
    label: "Default",
    description: "Preset style and tone",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Polished and precise",
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm and chatty",
  },
] as const;

/** Union of all valid personality string values, derived from the options array. */
export type Personality = (typeof PERSONALITY_OPTIONS)[number]["value"];

/**
 * Fallback when the cookie is absent or contains an unrecognised value.
 * "default" maps to the same warm/friendly tone as the base `regularPrompt`
 * so the user experience is unchanged when no preference has been set.
 */
export const DEFAULT_PERSONALITY: Personality = "default";

/**
 * Maps each personality to a one-sentence system-prompt instruction that is
 * prepended to the base prompt in `systemPrompt()`.
 *
 * Why a prepended instruction rather than a separate system message?
 * LLMs weight tokens near the start of the context most heavily (primacy
 * bias).  Placing the personality instruction first ensures the model
 * prioritises tone above all other rules.  A separate system message would
 * risk being shadowed by the longer base prompt that follows.
 *
 * Each instruction is written as an imperative ("Adopt a …") to minimise
 * ambiguity.  Descriptive prompts ("You are friendly") are less reliable
 * because the model may interpret the description as a statement of current
 * state rather than a directive to change behaviour.
 */
export const PERSONALITY_PROMPTS: Record<Personality, string> = {
  default:
    "Adopt a warm, friendly tone. Be approachable and encouraging while staying concise and helpful.",
  professional:
    "Adopt a polished, professional tone. Use precise, formal language and well-structured responses. Favour industry-appropriate terminology, avoid filler, and maintain a measured, authoritative voice throughout.",
  friendly:
    "Adopt a warm, chatty tone. Be conversational and casual — use contractions, show genuine enthusiasm, add light humour where it fits naturally, and make the user feel at ease. Prioritise connection over formality.",
};
