/**
 * Full customer + admin browser journey with screenshots.
 * Run: node scripts/journey-audit.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@houseofrivana.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
const OUT = path.resolve("screenshots/journey");
const findings = [];

fs.mkdirSync(OUT, { recursive: true });

function note(severity, area, message) {
  findings.push({ severity, area, message });
  console.log(`[${severity}] ${area}: ${message}`);
}

async function shot(page, name) {
  const file = path.join(OUT, `${String(findings.length).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📷 ${path.basename(file)}`);
  return file;
}

async function safeGoto(page, url) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  // Allow reveal failsafe (~900ms) so content is painted before screenshots.
  await page.waitForTimeout(1100);
  return res;
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 250,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-IN",
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => note("bug", "pageerror", err.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Dev-only noise (HMR / extension / favicon) — ignore in the audit summary.
    if (
      /WebSocket|_next\/hmr|favicon|net::ERR_INVALID_HTTP_RESPONSE|403 \(Forbidden\)/i.test(
        text,
      )
    ) {
      return;
    }
    note("bug", "console", text);
  });

  console.log("\n=== CUSTOMER JOURNEY ===\n");

  // 1. Home
  let res = await safeGoto(page, `${BASE}/`);
  if (!res || res.status() >= 400) note("bug", "home", `HTTP ${res?.status()}`);
  await page.waitForTimeout(800);
  await shot(page, "home");
  const logo = page.locator('img[alt*="Rivana"], a[aria-label*="Rivana"]').first();
  if (!(await logo.count())) note("bug", "home", "Brand logo not found in header");
  const adminLink = page.getByRole("link", { name: /^Admin/i }).first();
  if (!(await adminLink.count())) note("bug", "home", "Admin link missing from chrome");
  else note("ok", "home", "Admin link visible");

  // 2. Shop
  await page.getByRole("link", { name: /Shop All|Shop/i }).first().click().catch(async () => {
    await safeGoto(page, `${BASE}/shop`);
  });
  await page.waitForURL(/\/shop/, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, "shop");
  const productLinks = page.locator('a[href^="/product/"]');
  const productCount = await productLinks.count();
  if (productCount === 0) note("bug", "shop", "No product cards on /shop");
  else note("ok", "shop", `${productCount} product links visible`);

  // 3. PDP + add to bag
  if (productCount > 0) {
    await productLinks.first().click();
    await page.waitForURL(/\/product\//, { timeout: 20_000 });
    await page.waitForTimeout(1000);
    await shot(page, "pdp");
    const addBtn = page.getByRole("button", { name: /add to bag/i }).first();
    if (await addBtn.count()) {
      await addBtn.click();
      await page.waitForTimeout(1200);
      await shot(page, "cart-drawer");
      const drawer = page.getByRole("dialog").or(page.locator('[class*="fixed"]').filter({ hasText: /bag|checkout/i }));
      note("ok", "cart", "Add to bag clicked");
      // Close drawer if open, go to cart page
      const checkoutInDrawer = page.getByRole("link", { name: /checkout|view bag|your bag/i }).first();
      if (await checkoutInDrawer.count()) {
        // stay and screenshot then go to cart
      }
    } else {
      note("bug", "pdp", "Add to bag button not found");
    }
  }

  // 4. Cart page
  await safeGoto(page, `${BASE}/cart`);
  await page.waitForTimeout(800);
  await shot(page, "cart-page");
  const emptyBag = await page.getByText(/bag is empty/i).count();
  if (emptyBag) note("warn", "cart", "Cart still empty after add — guest cart may not persist");
  else note("ok", "cart", "Cart has items");

  // 5. Checkout
  await safeGoto(page, `${BASE}/checkout`);
  await page.waitForTimeout(800);
  await shot(page, "checkout");
  const checkoutHeading = page.locator("h1, h2").first();
  note("ok", "checkout", `Checkout loaded: ${(await checkoutHeading.textContent())?.trim() ?? "?"}`);

  // 6. Collections / About / Contact
  for (const route of ["/collections", "/about", "/contact", "/size-guide"]) {
    res = await safeGoto(page, `${BASE}${route}`);
    await page.waitForTimeout(500);
    await shot(page, route.replace(/\//g, "") || "root");
    if (!res || res.status() >= 400) note("bug", route, `HTTP ${res?.status()}`);
  }

  // 7. Account gate
  await safeGoto(page, `${BASE}/account`);
  await page.waitForTimeout(600);
  await shot(page, "account-redirect");
  if (!page.url().includes("/login")) note("bug", "account", "Expected redirect to /login");
  else note("ok", "account", "Anonymous users redirected to login");

  console.log("\n=== ADMIN JOURNEY ===\n");

  // 8. Admin login
  await safeGoto(page, `${BASE}/admin/login`);
  await page.waitForTimeout(600);
  await shot(page, "admin-login");
  const email = page.getByLabel(/email/i).first();
  const password = page.getByLabel(/password/i).first();
  if (!(await email.count()) || !(await password.count())) {
    note("bug", "admin-login", "Email/password fields missing");
  } else {
    await email.fill(ADMIN_EMAIL);
    await password.fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
    await Promise.race([
      page.waitForURL((url) => !url.pathname.includes("/admin/login"), {
        timeout: 12_000,
      }),
      page.waitForTimeout(12_000),
    ]).catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, "admin-after-login");
    if (page.url().includes("/admin/login")) {
      note("bug", "admin-login", `Login failed or stayed on login. URL=${page.url()}`);
      // capture error toast/text
      const bodyText = await page.locator("body").innerText();
      if (/invalid|incorrect|error|forbidden/i.test(bodyText)) {
        note("bug", "admin-login", "Error message visible on login page");
      }
    } else {
      note("ok", "admin-login", `Logged in → ${page.url()}`);
    }
  }

  // If still on login, try seed again hint and stop admin tour
  if (page.url().includes("/admin/login")) {
    note("warn", "admin", "Skipping admin catalogue tour — not authenticated");
  } else {
    const adminRoutes = [
      ["/admin", "dashboard"],
      ["/admin/products", "products"],
      ["/admin/products/new", "product-new"],
      ["/admin/collections", "collections"],
      ["/admin/inventory", "inventory"],
      ["/admin/orders", "orders"],
      ["/admin/payments/review", "payments"],
      ["/admin/settings", "settings"],
    ];
    for (const [route, name] of adminRoutes) {
      res = await safeGoto(page, `${BASE}${route}`);
      await page.waitForTimeout(700);
      await shot(page, `admin-${name}`);
      if (!res || res.status() >= 400) note("bug", route, `HTTP ${res?.status()}`);
      if (page.url().includes("/admin/login")) {
        note("bug", route, "Redirected to admin login — session lost");
        break;
      } else {
        note("ok", route, "Loaded");
      }
    }

    // Try opening first product for edit
    await safeGoto(page, `${BASE}/admin/products`);
    await page.waitForTimeout(800);
    const editLink = page.locator('a[href^="/admin/products/"]').filter({ hasNotText: /new/i }).first();
    if (await editLink.count()) {
      await editLink.click();
      await page.waitForTimeout(1000);
      await shot(page, "admin-product-edit");
      const deleteBtn = page.getByRole("button", { name: /delete|archive/i }).first();
      if (await deleteBtn.count()) note("ok", "product-edit", "Delete/Archive control present");
      else note("warn", "product-edit", "No Delete/Archive button visible");
    } else {
      note("warn", "products", "No product edit links found");
    }
  }

  // Mobile viewport spot check
  await page.setViewportSize({ width: 390, height: 844 });
  await safeGoto(page, `${BASE}/`);
  await page.waitForTimeout(700);
  await shot(page, "mobile-home");
  const menuBtn = page.getByRole("button", { name: /open menu/i });
  if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "mobile-menu");
    const mobileAdmin = page.getByRole("link", { name: /admin/i });
    if (await mobileAdmin.count()) note("ok", "mobile", "Admin login in mobile menu");
    else note("bug", "mobile", "Admin login missing in mobile menu");
  }

  await browser.close();

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    screenshots: OUT,
    findings,
    summary: {
      bugs: findings.filter((f) => f.severity === "bug").length,
      warnings: findings.filter((f) => f.severity === "warn").length,
      ok: findings.filter((f) => f.severity === "ok").length,
    },
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log(report.summary);
  console.log(`Screenshots: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
