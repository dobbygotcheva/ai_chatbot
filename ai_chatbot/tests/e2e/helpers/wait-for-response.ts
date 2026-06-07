import type { Page } from "@playwright/test";

/**
 * Waits for the AI assistant to finish thinking and display a complete response.
 *
 * @param page - Playwright page instance
 * @param options - Configuration options
 * @param options.timeout - Timeout in milliseconds (default: 60_000)
 * @param options.minLength - Minimum text length to consider response complete (default: 20)
 */
export async function waitForAssistantResponse(
  page: Page,
  options: { timeout?: number; minLength?: number } = {}
): Promise<void> {
  const { timeout = 60_000, minLength = 20 } = options;

  await page.waitForFunction(
    ([minLength]) => {
      const messages = Array.from(
        document.querySelectorAll('[data-role="assistant"]')
      );
      const lastMessage = messages.at(-1);
      if (!lastMessage) {
        return false;
      }
      const text = lastMessage.textContent || "";
      return (
        !text.includes("...") &&
        !text.toLowerCase().includes("thinking") &&
        text.length >= minLength
      );
    },
    [minLength],
    { timeout }
  );
}

/**
 * Gets the text content of the latest assistant message.
 *
 * @param page - Playwright page instance
 * @returns Promise resolving to the message text
 */
export async function getLatestAssistantMessage(page: Page): Promise<string> {
  const finalMessage = await page.locator('[data-role="assistant"]').last();
  return (await finalMessage.textContent()) || "";
}

/**
 * Gets the text content of the latest assistant message with a timeout.
 *
 * @param page - Playwright page instance
 * @param timeout - Timeout in milliseconds
 * @returns Promise resolving to the message text
 */
export async function getLatestAssistantMessageWithTimeout(
  page: Page,
  timeout = 5000
): Promise<string> {
  const finalMessage = await page.locator('[data-role="assistant"]').last();
  return (await finalMessage.textContent({ timeout })) || "";
}
