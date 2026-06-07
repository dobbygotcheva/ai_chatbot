import { codeToHtml } from "shiki";

/**
 * Apply syntax highlighting to code output using shiki.
 * Falls back to plain text if highlighting fails.
 */
export async function highlightCode(
  code: string,
  language = "text"
): Promise<string> {
  try {
    const highlighted = await codeToHtml(code, {
      lang: language,
      theme: "github-dark",
    });
    return highlighted;
  } catch {
    // Fallback to plain text if highlighting fails
    return code;
  }
}
