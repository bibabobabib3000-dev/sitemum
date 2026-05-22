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

  test("redirects unauthenticated users away from /uk/admin", async ({
    page,
  }) => {
    await page.goto("/uk/admin");
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /ru/admin", async ({
    page,
  }) => {
    await page.goto("/ru/admin");
    await expect(page).toHaveURL(/\/ru\/login/);
  });

  test("redirects unauthenticated users away from /uk/admin/cases", async ({
    page,
  }) => {
    await page.goto("/uk/admin/cases");
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /uk/admin/users", async ({
    page,
  }) => {
    await page.goto("/uk/admin/users");
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /uk/account", async ({
    page,
  }) => {
    await page.goto("/uk/account");
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /ru/account", async ({
    page,
  }) => {
    await page.goto("/ru/account");
    await expect(page).toHaveURL(/\/ru\/login/);
  });

  test("redirects unauthenticated users away from /uk/banned", async ({
    page,
  }) => {
    await page.goto("/uk/banned");
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /uk/dashboard/notes", async ({
    page,
  }) => {
    await page.goto("/uk/dashboard/notes");
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test("redirects unauthenticated users away from /uk/dashboard/bookmarks", async ({
    page,
  }) => {
    await page.goto("/uk/dashboard/bookmarks");
    await expect(page).toHaveURL(/\/uk\/login/);
  });
});
