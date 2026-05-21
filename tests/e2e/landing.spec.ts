import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("renders the Ukrainian hero on /uk", async ({ page }) => {
    await page.goto("/uk");
    await expect(
      page.getByRole("heading", { level: 1, name: /Immersion Week/i })
    ).toBeVisible();
  });

  test("renders the Russian hero on /ru", async ({ page }) => {
    await page.goto("/ru");
    await expect(
      page.getByRole("heading", { level: 1, name: /Immersion Week/i })
    ).toBeVisible();
  });

  test("exposes a PWA manifest", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toBeTruthy();
    expect(json.start_url).toBeTruthy();
    expect(Array.isArray(json.icons)).toBe(true);
    expect(json.icons.length).toBeGreaterThan(0);
  });

  test("ships a service worker at /sw.js", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toContain("javascript");
  });
});
