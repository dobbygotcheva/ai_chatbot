import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Only load .env.local if it exists (not in CI)
if (existsSync(".env.local")) {
  config({
    path: ".env.local",
  });
}

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;

const isCI = !!process.env.CI;

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,
  /* Retry on CI only */
  retries: isCI ? 1 : 0,
  /* Run 4 workers in parallel for faster test execution */
  workers: 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: isCI
    ? [
        ["junit", { outputFile: "test-results/e2e-junit-results.xml" }],
        ["html"],
      ]
    : "html",
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL,
    storageState: "tests/.auth/user.json",
    trace: "retain-on-failure",
  },

  /* Configure global timeout for each test */
  timeout: 120 * 1000, // 120 seconds - increased for code execution tests
  expect: {
    timeout: 30 * 1000, // 30 seconds - increased for slower assertions
  },

  /* Configure projects */
  projects: [
    {
      name: "e2e",
      testMatch: /e2e\/.*\.test\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev",
    url: `${baseURL}/ping`,
    timeout: 120 * 1000,
    reuseExistingServer: !isCI,
  },
});
