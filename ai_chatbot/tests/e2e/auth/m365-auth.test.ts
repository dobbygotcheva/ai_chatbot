import { expect, test } from "@playwright/test";

test.describe("M365 Authentication", () => {
  test("should have valid session from global setup", async ({ page }) => {
    const response = await page.request.get("/api/auth/session");
    const session = await response.json();

    expect(session.user).toBeDefined();
    expect(session.user.email).toBe("dev@mail.com");
    expect(session.user.azureAdId).toBe("dev-uuid");
  });

  test("should maintain session after page reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    let response = await page.request.get("/api/auth/session");
    let session = await response.json();
    expect(session.user).toBeDefined();
    expect(session.user.email).toBe("dev@mail.com");

    await page.reload();
    await page.waitForLoadState("networkidle");

    response = await page.request.get("/api/auth/session");
    session = await response.json();
    expect(session.user).toBeDefined();
    expect(session.user.email).toBe("dev@mail.com");
  });

  test("should redirect authenticated users from login page", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    expect(currentUrl).not.toContain("/login");
  });
});

test.describe("M365 Authentication - API Tests", () => {
  test("should accept auth callback with code", async ({ page }) => {
    const response = await page.request.get(
      "/api/auth/callback/azure-ad?code=test-code&state=test"
    );

    expect([200, 302, 307, 308]).toContain(response.status());
  });
});
