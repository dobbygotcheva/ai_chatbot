import { expect, test } from "@playwright/test";

test.describe("Chat Speed Slider", () => {
  test("should persist text-speed to localStorage across page reload", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="multimodal-input"]');

    await page.evaluate(() => {
      localStorage.setItem("text-speed", "50");
    });

    await page.reload();
    await page.waitForSelector('[data-testid="multimodal-input"]');

    const textSpeed = await page.evaluate(() => {
      return localStorage.getItem("text-speed");
    });

    expect(textSpeed).toBe("50");
  });

  test("should render slider with persisted value", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="multimodal-input"]');

    await page.evaluate(() => {
      localStorage.setItem("text-speed", "75");
    });

    await page.reload();
    await page.waitForSelector('[data-testid="multimodal-input"]');

    const slider = page.getByLabel("Text streaming speed");
    await expect(slider).toHaveAttribute("aria-valuenow", "75");
  });
});
