import { expect, test } from "@playwright/test";

test.describe("Token Creation Flow", () => {
  test("creates a personal token end-to-end", async ({ page }) => {
    const tokenName = `E2E Test Token ${Date.now()}`;

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Personal Tokens" }).click();

    await expect(page.getByTestId("create-new-token-button")).toBeVisible();

    await page.getByTestId("create-new-token-button").click();

    await page.getByTestId("token-name-input").fill(tokenName);

    await page.locator("#token-expiry").click();
    await page.getByRole("option", { name: "30 days" }).click();

    await page
      .getByRole("button", { name: "Create token", exact: true })
      .click();

    await page.getByRole("button", { name: "Show token" }).last().click();

    const tokenCode = page.locator("code").filter({ hasText: /^sm-/ });
    await expect(tokenCode).toBeVisible();
    const tokenText = await tokenCode.textContent();
    expect(tokenText).toMatch(/^sm-[a-f0-9]{64}$/);

    await page.getByRole("button", { name: "Copy token" }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(1000);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Personal Tokens" }).click();

    await expect(
      page.getByRole("cell", { name: tokenName, exact: true })
    ).toBeVisible();

    const revokeButton = page
      .getByRole("row", { name: new RegExp(tokenName) })
      .getByRole("button", { name: `Revoke ${tokenName}` });
    await revokeButton.click();
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByRole("cell", { name: tokenName })).toHaveCount(0);
  });
});
