import { expect, test } from "@playwright/test";

test.describe("Environment Access Control", () => {
  test("should block production user from accessing local environment", async ({
    page,
  }) => {
    const redirectUri = encodeURIComponent(
      "http://localhost:3000/api/auth/callback/azure-ad"
    );
    await page.goto(`http://localhost:8080/login?redirect_uri=${redirectUri}`, {
      timeout: 10_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 });

    await page.click("#toggleCustom", { timeout: 5000 });
    await page.waitForSelector("#customForm.visible", { timeout: 5000 });

    await page.fill("#customEmail", "prod-user@test.com", { timeout: 5000 });
    await page.check('input[value="SG-EGT-AI-CENTER-USERS"]', {
      timeout: 5000,
    });

    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }),
      page.click("#customForm .submit-btn", { timeout: 5000 }),
    ]);

    await page.waitForLoadState("networkidle", { timeout: 10_000 });

    // Should be redirected to error page
    await expect(page).toHaveURL(/.*\/auth\/error.*/, { timeout: 5000 });

    // Check for error message on error page (use specific selector to avoid matching <title>)
    const errorTitle = page.getByRole("heading", { name: "Access Denied" });
    await expect(errorTitle).toBeVisible({ timeout: 5000 });
  });

  test("should allow test user to access local environment", async ({
    page,
  }) => {
    const redirectUri = encodeURIComponent(
      "http://localhost:3000/api/auth/callback/azure-ad"
    );
    await page.goto(`http://localhost:8080/login?redirect_uri=${redirectUri}`, {
      timeout: 10_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 });

    await page.click("#toggleCustom", { timeout: 5000 });
    await page.waitForSelector("#customForm.visible", { timeout: 5000 });

    await page.fill("#customEmail", "test-user@test.com", { timeout: 5000 });
    await page.check('input[value="SG-EGT-AI-CENTER-TEST-USERS"]', {
      timeout: 5000,
    });

    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }),
      page.click("#customForm .submit-btn", { timeout: 5000 }),
    ]);

    await page.waitForLoadState("networkidle", { timeout: 10_000 });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain("/login");
    expect(currentUrl).toContain("localhost:3000");

    const response = await page.request.get("/api/auth/session", {
      timeout: 5000,
    });
    const session = await response.json();

    expect(session.user).toBeDefined();
    expect(session.user.email).toBe("test-user@test.com");
  });
});
