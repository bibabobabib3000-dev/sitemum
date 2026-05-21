import { test, expect } from "@playwright/test";

test.describe("auth gate", () => {
  test("redirects unauthenticated users away from /uk/dashboard", async ({
    page,
  }) => {
    const res = await page.goto("/uk/dashboard");
    expect(res).toBeTruthy();
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /uk/dashboard/roadmap", async ({
    page,
  }) => {
    await page.goto("/uk/dashboard/roadmap");
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /uk/dashboard/level-1/case-study", async ({
    page,
  }) => {
    await page.goto("/uk/dashboard/level-1/case-study");
    await expect(page).toHaveURL(/\/uk\/login/);
  });
});
