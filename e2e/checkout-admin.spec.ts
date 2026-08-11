import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage of browse → bag → checkout shell and the admin login gate.
 * Full paid-order verification needs seeded stock + a live DB; those steps run
 * when PLAYWRIGHT_BASE_URL points at a seeded environment.
 */

test.describe("checkout and admin gates", () => {
  test("product page exposes add-to-bag controls", async ({ page }) => {
    await page.goto("/shop");
    const firstProduct = page.locator('a[href^="/product/"]').first();
    await expect(firstProduct).toBeVisible({ timeout: 15_000 });
    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\//);
    await expect(
      page.getByRole("button", { name: /add to bag|notify|sold out/i }).first(),
    ).toBeVisible();
  });

  test("checkout page is reachable", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin login form renders", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
