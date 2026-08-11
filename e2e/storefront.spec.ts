import { expect, test } from "@playwright/test";

test.describe("storefront smoke", () => {
  test("home page renders the brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner").getByText(/rivana/i).first()).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("shop page lists the catalog", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Seeded catalog should show at least one product card link.
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("account area redirects anonymous visitors to login", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin area redirects anonymous visitors to admin login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
