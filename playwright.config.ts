import { defineConfig, devices } from "@playwright/test";

// Playwright runs the smoke / e2e suite in `tests/e2e/**` against a real
// production Next.js build (`next start`). We use a non-standard port so a
// developer can keep `pnpm dev` running at :3000 in parallel.
const PORT = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3010", 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Build and start a production server. We deliberately omit DB/auth env
    // vars so the app runs in its documented "stub mode" — the smoke flow
    // (landing → lead form → thank-you, auth-gate redirect, PWA artefacts)
    // is fully exercisable without a Postgres instance.
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
});
