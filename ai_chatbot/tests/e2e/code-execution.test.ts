import { expect, test } from "@playwright/test";
import {
  getLatestAssistantMessage,
  waitForAssistantResponse,
} from "./helpers/wait-for-response";

test.describe("Code Execution Tool E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.setTimeout(120_000);

  test("AI should autonomously use code execution for percentage calculation", async ({
    page,
  }) => {
    await page.fill(
      "[data-testid='multimodal-input']",
      "What is 15% of 250? Please use code to calculate."
    );
    await page.waitForSelector("[data-testid='send-button']:not([disabled])");
    await page.click("[data-testid='send-button']");

    const assistantMessage = await page
      .locator('[data-role="assistant"]')
      .last();
    await expect(assistantMessage).toBeVisible({ timeout: 30_000 });

    await waitForAssistantResponse(page, { timeout: 90_000 });

    const messageText = await getLatestAssistantMessage(page);

    expect(messageText.toLowerCase()).toMatch(
      /(executed|ran code|code execution|result|output|python|javascript)/
    );
    expect(messageText).toContain("37.5");

    await page.screenshot({
      path: "tests/e2e/screenshots/calculation-execution.png",
      fullPage: false,
    });
  });

  test("should execute Python data analysis code for mean calculation", async ({
    page,
  }) => {
    await page.fill(
      "[data-testid='multimodal-input']",
      "Calculate the mean of [10, 20, 30, 40, 50] using Python"
    );
    await page.waitForSelector("[data-testid='send-button']:not([disabled])");
    await page.click("[data-testid='send-button']");

    const assistantMessage = await page
      .locator('[data-role="assistant"]')
      .last();
    await expect(assistantMessage).toBeVisible({ timeout: 30_000 });

    await waitForAssistantResponse(page);

    const messageText = await getLatestAssistantMessage(page);

    expect(messageText.toLowerCase()).toMatch(
      /(python|executed|mean|average|result)/
    );

    expect(messageText).toContain("30");

    await page.screenshot({
      path: "tests/e2e/screenshots/python-data-analysis.png",
      fullPage: false,
    });
  });

  test("should execute JavaScript calculation code", async ({ page }) => {
    await page.fill(
      "[data-testid='multimodal-input']",
      "Run this JavaScript: console.log(123 * 456)"
    );
    await page.waitForSelector("[data-testid='send-button']:not([disabled])");
    await page.click("[data-testid='send-button']");

    const assistantMessage = await page
      .locator('[data-role="assistant"]')
      .last();
    await expect(assistantMessage).toBeVisible({ timeout: 30_000 });

    await waitForAssistantResponse(page);

    const messageText = await getLatestAssistantMessage(page);

    expect(messageText.toLowerCase()).toMatch(
      /(javascript|js|executed|result|output)/
    );

    expect(messageText).toContain("56088");

    await page.screenshot({
      path: "tests/e2e/screenshots/javascript-calculation.png",
      fullPage: false,
    });
  });

  test("should display user-friendly error message for broken code", async ({
    page,
  }) => {
    await page.fill(
      "[data-testid='multimodal-input']",
      "Execute this Python code: print(invalid_syntax_error"
    );
    await page.waitForSelector("[data-testid='send-button']:not([disabled])");
    await page.click("[data-testid='send-button']");

    const assistantMessage = await page
      .locator('[data-role="assistant"]')
      .last();
    await expect(assistantMessage).toBeVisible({ timeout: 30_000 });

    await waitForAssistantResponse(page);

    const messageText = await getLatestAssistantMessage(page);

    expect(messageText.toLowerCase()).toMatch(
      /(error|syntax|failed|invalid|issue|problem|couldn't|unable to)/
    );

    await page.screenshot({
      path: "tests/e2e/screenshots/error-handling.png",
      fullPage: false,
    });
  });

  test("should display file output from code execution", async ({ page }) => {
    await page.fill(
      "[data-testid='multimodal-input']",
      "Create a Python script that generates a CSV file with sample data and show me the contents"
    );
    await page.waitForSelector("[data-testid='send-button']:not([disabled])");
    await page.click("[data-testid='send-button']");

    const assistantMessage = await page
      .locator('[data-role="assistant"]')
      .last();
    await expect(assistantMessage).toBeVisible({ timeout: 30_000 });

    await waitForAssistantResponse(page, { timeout: 90_000 });

    const messageText = await getLatestAssistantMessage(page);

    expect(messageText.toLowerCase()).toMatch(
      /(file|csv|created|generated|output|contents|data)/
    );
    expect(messageText.toLowerCase()).toMatch(/(executed|ran|python|code)/);

    await page.screenshot({
      path: "tests/e2e/screenshots/file-output.png",
      fullPage: false,
    });
  });
});
