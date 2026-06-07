import { expect, test } from "@playwright/test";

test.describe("Admin Access Control", () => {
  test("admin user can access metrics page", async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.click("#m365-login-button");
    await page.waitForLoadState("networkidle");

    await page.waitForURL(/localhost:8080\/login.*/, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await page.click('button:has-text("admin@mail.com")');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.goto("/admin/metrics");
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { name: "Metrics Dashboard" });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("dev user is blocked from metrics page with 404", async ({
    context,
    page,
  }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.click("#m365-login-button");
    await page.waitForLoadState("networkidle");

    await page.waitForURL(/localhost:8080\/login.*/, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await page.click('button:has-text("dev@mail.com")');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.goto("/admin/metrics");
    await page.waitForLoadState("networkidle");

    const heading = page.locator("h1");
    const headingText = await heading.textContent();
    expect(headingText).toContain("404");

    await expect(page.locator("text=Page not found")).toBeVisible({
      timeout: 5000,
    });
  });

  test("unauthenticated user is redirected to login from admin page", async ({
    context,
    page,
  }) => {
    await context.clearCookies();
    await page.goto("/admin/metrics");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });
});
