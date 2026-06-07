import { expect, test } from "@playwright/test";

test.describe("PDF Export", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
  });

  test("pdf icon is visible on messages", async ({ page }) => {
    await page
      .getByTestId("multimodal-input")
      .fill("Test message for PDF export");
    await page.getByTestId("multimodal-input").press("Enter");

    const message = page.getByTestId("message-assistant");
    await expect(message).toBeVisible();
    await message.scrollIntoViewIfNeeded();
    const printButton = message.getByTestId("message-print");
    await printButton.click();
  });

  test("print button triggers iframe creation and cleanup", async ({
    page,
  }) => {
    await page.getByTestId("multimodal-input").fill("Test");
    await page.getByTestId("multimodal-input").press("Enter");

    const message = page.getByTestId("message-assistant");
    await expect(message).toBeVisible();
    await message.scrollIntoViewIfNeeded();

    const printButton = message.getByTestId("message-print");
    await printButton.click();

    const iframe = page.locator("iframe");
    await expect(iframe).toHaveCount(1);

    await page.waitForTimeout(3000);

    await expect(iframe).toHaveCount(0);
  });

  test("print button has correct label", async ({ page }) => {
    await page.getByTestId("multimodal-input").fill("Test");
    await page.getByTestId("multimodal-input").press("Enter");

    const message = page.getByTestId("message-assistant");
    await expect(message).toBeVisible();
    await message.scrollIntoViewIfNeeded();

    const printButton = message.getByTestId("message-print");
    await expect(printButton.locator(".sr-only")).toHaveText(/PDF/i);
  });

  test("iframe is cleaned up after print", async ({ page }) => {
    await page.getByTestId("multimodal-input").fill("Test message for cleanup");
    await page.getByTestId("multimodal-input").press("Enter");

    const message = page.getByTestId("message-assistant");
    await expect(message).toBeVisible();
    await message.scrollIntoViewIfNeeded();

    const printButton = message.getByTestId("message-print");
    await printButton.click();

    const iframe = page.locator("iframe");
    await expect(iframe).toHaveCount(1);

    await page.evaluate(() => {
      const iframeElement = document.querySelector("iframe");
      iframeElement?.contentWindow?.dispatchEvent(new Event("afterprint"));
    });

    await expect(iframe).toHaveCount(0);
  });
});
