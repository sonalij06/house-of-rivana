/**
 * Admin field-error regression suite.
 * Run: node scripts/e2e-admin-field-errors.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@houseofrivana.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
const OUT = path.resolve("screenshots/e2e-admin-field-errors");
const stamp = Date.now().toString(36);

fs.mkdirSync(OUT, { recursive: true });

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  results.push({ ok: false, name, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: true,
  });
}

async function login(page) {
  const response = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { Origin: BASE },
  });
  if (!response.ok()) {
    throw new Error(`sign-in failed: ${response.status()} ${await response.text()}`);
  }
  await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
}

async function openFirstProduct(page) {
  const link = page
    .locator('a[href^="/admin/products/"]')
    .filter({ hasNot: page.locator('[href$="/new"]') })
    .filter({ hasNotText: /^new/i })
    .first();
  // Prefer table/list links that look like product IDs (cuid), not /new.
  const productLink = page.locator('a[href*="/admin/products/c"]').first();
  const target = (await productLink.count()) > 0 ? productLink : link;
  await target.waitFor({ state: "visible", timeout: 15_000 });
  await target.click();
  await page.waitForURL(
    (url) =>
      /\/admin\/products\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
    { timeout: 15_000 },
  );
}

async function expectFieldAlert(page, text) {
  const alert = page.getByRole("alert").filter({ hasText: text });
  await alert.first().waitFor({ state: "visible", timeout: 8_000 });
  return alert.first();
}

async function main() {
  const browser = await chromium.launch({ headless: true, slowMo: 30 });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  console.log("\nAdmin field-error suite\n");

  try {
    await login(page);
    pass("admin login");

    await openFirstProduct(page);
    pass("open product editor", page.url());

    await page.getByRole("button", { name: /add variant/i }).click();
    const form = page.locator("form").filter({ has: page.locator("#sku") }).last();
    await form.waitFor({ state: "visible" });

    // a) short SKU
    await form.locator("#sku").fill("AB");
    await form.locator("#label").fill("Test label");
    await form.locator("#priceRupees").fill("999");
    await form.locator("#stockQty").fill("1");
    await form.getByRole("button", { name: /add variant|save variant/i }).click();
    try {
      await expectFieldAlert(page, "A SKU needs at least three characters.");
      pass("variant short SKU shows field alert");
    } catch (err) {
      await shot(page, "short-sku");
      fail("variant short SKU shows field alert", String(err));
    }

    // b) invalid SKU chars
    await form.locator("#sku").fill("BAD SKU!");
    await form.getByRole("button", { name: /add variant|save variant/i }).click();
    try {
      await expectFieldAlert(page, "Use capitals, digits and hyphens only.");
      pass("variant invalid SKU shows field alert");
    } catch (err) {
      await shot(page, "invalid-sku");
      fail("variant invalid SKU shows field alert", String(err));
    }

    // c) empty label
    await form.locator("#sku").fill(`E2E-${stamp}`);
    await form.locator("#label").fill("");
    await form.getByRole("button", { name: /add variant|save variant/i }).click();
    try {
      await expectFieldAlert(page, "Give the variant a label.");
      pass("variant empty label shows field alert");
    } catch (err) {
      await shot(page, "empty-label");
      fail("variant empty label shows field alert", String(err));
    }

    // d) happy path create
    const sku = `E2E-${stamp}`;
    await form.locator("#sku").fill(sku);
    await form.locator("#label").fill("E2E field-error variant");
    await form.locator("#priceRupees").fill("1250");
    await form.locator("#stockQty").fill("3");
    await form.getByRole("button", { name: /add variant|save variant/i }).click();
    try {
      await page.getByText(sku).first().waitFor({ state: "visible", timeout: 10_000 });
      pass("valid variant saves", sku);
    } catch (err) {
      await shot(page, "valid-save");
      fail("valid variant saves", String(err));
    }

    // e) duplicate SKU
    await page.getByRole("button", { name: /add variant/i }).click();
    const form2 = page.locator("form").filter({ has: page.locator("#sku") }).last();
    await form2.waitFor({ state: "visible" });
    await form2.locator("#sku").fill(sku);
    await form2.locator("#label").fill("Duplicate attempt");
    await form2.locator("#priceRupees").fill("100");
    await form2.locator("#stockQty").fill("1");
    await form2.getByRole("button", { name: /add variant|save variant/i }).click();
    try {
      await expectFieldAlert(page, "already exists");
      pass("duplicate SKU shows field alert");
    } catch (err) {
      await shot(page, "duplicate-sku");
      fail("duplicate SKU shows field alert", String(err));
    }

    // Product slug field error
    await page.goto(`${BASE}/admin/products/new`, { waitUntil: "networkidle" });
    await page.locator("#name").fill("Field Error Probe");
    await page.locator("#slug").fill("BAD SLUG");
    await page.locator("#description").fill(
      "This description is long enough to pass the minimum length check for products.",
    );
    await page.locator("#basePriceRupees").fill("500");
    await page.getByRole("button", { name: /create product/i }).click();
    try {
      await expectFieldAlert(page, "Use lowercase words separated by hyphens.");
      pass("product invalid slug shows field alert");
    } catch (err) {
      await shot(page, "product-slug");
      fail("product invalid slug shows field alert", String(err));
    }

    // Collection slug clash / validation
    await page.goto(`${BASE}/admin/collections`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /new collection/i }).click();
    const cform = page.locator("form").filter({ has: page.locator("#slug") }).last();
    await cform.locator("#name").fill("X");
    await cform.locator("#slug").fill("bad slug");
    await cform.getByRole("button", { name: /create collection/i }).click();
    try {
      const alerts = page.getByRole("alert");
      await alerts.first().waitFor({ state: "visible", timeout: 8_000 });
      const texts = await alerts.allTextContents();
      if (texts.some((t) => /name|slug|hyphen|character/i.test(t))) {
        pass("collection validation shows field alert", texts.join(" | "));
      } else {
        fail("collection validation shows field alert", texts.join(" | "));
      }
    } catch (err) {
      await shot(page, "collection");
      fail("collection validation shows field alert", String(err));
    }
  } catch (err) {
    await shot(page, "fatal");
    fail("suite setup", String(err));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  console.log(`Screenshots: ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
