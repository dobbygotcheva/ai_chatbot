import { chromium, type FullConfig } from "@playwright/test";
import { config } from "@/shared/config";

async function globalSetup(playwrightConfig: FullConfig) {
  const { baseURL } = playwrightConfig.projects[0].use;
  const authDir = "tests/.auth";
  const authFile = `${authDir}/user.json`;

  const { mkdir } = await import("node:fs/promises");
  await mkdir(authDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState("networkidle");

    await page.click("#m365-login-button");

    await page.waitForURL(`${config.auth.m365BaseUrl}/login*`, {
      timeout: 10_000,
    });

    await page.click('button:has-text("dev@mail.com")');

    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      throw new Error("Still on login page after M365 auth");
    }

    await page.context().storageState({ path: authFile });

    console.log("[auth] M365 session created for dev@mail.com");
    console.log(`[auth] Auth state saved to: ${authFile}`);
  } catch (error) {
    console.error("Global setup failed:", error);
    try {
      await page.screenshot({ path: `${authDir}/debug-screenshot.png` });
    } catch {
      // pass
    }
    try {
      const html = await page.content();
      const { writeFile } = await import("node:fs/promises");
      await writeFile(`${authDir}/debug-page.html`, html);
    } catch {
      // pass
    }
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
