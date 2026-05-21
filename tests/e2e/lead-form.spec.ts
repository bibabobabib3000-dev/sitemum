import { test, expect } from "@playwright/test";

test.describe("lead form", () => {
  test("submits in stub mode and shows the inline success", async ({
    page,
  }) => {
    await page.goto("/uk#form");

    // The lead form lives at the bottom of the landing page. We rely on
    // the `name` attribute exposed by <Field name="…" /> rather than the
    // visible Ukrainian label to keep the selector locale-stable.
    await page.locator('input[name="name"]').fill("E2E Smoke User");
    await page
      .locator('input[name="email"]')
      .fill(`e2e+${Date.now()}@resoul.test`);
    // `<Field name="telegram" required />` — HTML5 validation will block
    // submit if we leave this empty.
    await page.locator('input[name="telegram"]').fill("@e2e_smoke");

    await page.getByRole("button", { name: "Продовжити", exact: true }).click();

    await expect(
      page.getByText(/Дякуємо! Перевір Telegram/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("rejects an obviously bad email with a 422", async ({ request }) => {
    const res = await request.post("/api/lead", {
      data: {
        name: "Bad Email",
        email: "not-an-email",
        productSlug: "level-0",
      },
    });
    expect(res.status()).toBe(422);
  });
});
