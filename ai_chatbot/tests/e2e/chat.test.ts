import { expect, test } from "@playwright/test";

test.describe("Chat Page", () => {
  test("chat page loads with input field", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
  });
});
