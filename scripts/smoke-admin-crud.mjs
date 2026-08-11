/**
 * Walks every admin screen as an administrator, then exercises the write paths
 * that have no other coverage: a collection, a coupon, a stock adjustment, a
 * hero slide and review moderation.
 */
import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@houseofrivana.com";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const log = (step, detail) => console.log(`${step}: ${detail}`);
const toast = () =>
  page
    .locator("[data-sonner-toast]")
    .first()
    .innerText()
    .then((t) => t.replace(/\n/g, " | "))
    .catch(() => "(no toast)");

await page.goto(`${base}/admin/login`, { waitUntil: "domcontentloaded" });
await page.locator("#email").fill(email);
await page.locator("#password").fill(password);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30000 });
log("signed in", page.url().replace(base, ""));

const routes = [
  "/admin",
  "/admin/orders",
  "/admin/payments/review",
  "/admin/shipments",
  "/admin/products",
  "/admin/products/new",
  "/admin/collections",
  "/admin/inventory",
  "/admin/coupons",
  "/admin/customers",
  "/admin/reviews",
  "/admin/notifications",
  "/admin/content",
  "/admin/settings",
  "/admin/users",
  "/admin/audit-log",
];

for (const route of routes) {
  const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const heading = await page
    .locator("h1")
    .first()
    .innerText()
    .catch(() => "(no h1)");
  log(`route ${route}`, `${response.status()} · ${heading.replace(/\n/g, " ")}`);
}

// --- Collections -----------------------------------------------------------
await page.goto(`${base}/admin/collections`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /new collection/i }).click();
const stamp = Date.now().toString().slice(-6);
await page.locator("#name").fill(`Smoke ${stamp}`);
await page.locator("#slug").fill(`smoke-${stamp}`);
await page.locator("#subtitle").fill("Created by the smoke test");
await page.getByRole("button", { name: /create collection/i }).click();
await page.waitForTimeout(2500);
log("collection created", await toast());
log(
  "collection visible",
  String(await page.getByText(`smoke-${stamp}`).first().isVisible().catch(() => false)),
);

// --- Coupons ---------------------------------------------------------------
await page.goto(`${base}/admin/coupons`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /new coupon/i }).click();
await page.locator("#code").fill(`SMOKE${stamp}`);
await page.locator("#value").fill("12");
await page.locator("#minSubtotal").fill("5000");
await page.getByRole("button", { name: /create coupon/i }).click();
await page.waitForTimeout(2500);
log("coupon created", await toast());

// A percentage over the cap must be refused.
await page.getByRole("button", { name: /new coupon/i }).click();
await page.locator("#code").fill(`BAD${stamp}`);
await page.locator("#value").fill("95");
await page.getByRole("button", { name: /create coupon/i }).click();
await page.waitForTimeout(2000);
log("coupon cap guard", await toast());
await page.screenshot({ path: "screenshots/admin-coupons.png", fullPage: true });

// --- Inventory -------------------------------------------------------------
await page.goto(`${base}/admin/inventory`, { waitUntil: "domcontentloaded" });
const before = await page.locator("table tbody tr").first().innerText();
await page.getByRole("button", { name: /^Adjust$/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Add$/ }).first().click();
await page.waitForTimeout(2500);
log("stock adjusted", await toast());
log("row before", before.replace(/\n/g, " · ").slice(0, 90));
await page.screenshot({ path: "screenshots/admin-inventory.png", fullPage: true });

// The ledger must show the adjustment.
await page.reload({ waitUntil: "domcontentloaded" });
const movements = await page.locator("table").last().locator("tbody tr").first().innerText();
log("newest movement", movements.replace(/\n/g, " · ").slice(0, 110));

// --- Homepage --------------------------------------------------------------
await page.goto(`${base}/admin/content`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /add slide/i }).click();
await page.locator("#title").fill(`Smoke slide ${stamp}`);
await page.locator("#imageUrl").fill("/placeholders/hero-1.jpg");
await page.locator("#ctaLabel").fill("Explore");
await page.locator("#ctaHref").fill("/shop");
await page.getByRole("button", { name: /^Add slide$/ }).last().click();
await page.waitForTimeout(2500);
log("hero slide added", await toast());
await page.screenshot({ path: "screenshots/admin-content.png", fullPage: true });

// --- Reviews ---------------------------------------------------------------
await page.goto(`${base}/admin/reviews?status=PENDING`, { waitUntil: "domcontentloaded" });
const pending = await page.locator("article").count();
log("reviews pending", String(pending));
if (pending > 0) {
  await page.locator("article").first().getByRole("button", { name: /publish/i }).click();
  await page.waitForTimeout(2500);
  log("review published", await toast());
}
await page.screenshot({ path: "screenshots/admin-reviews.png", fullPage: true });

// --- Team ------------------------------------------------------------------
await page.goto(`${base}/admin/users`, { waitUntil: "domcontentloaded" });
log("team rows", String(await page.locator("table tbody tr").count()));
await page.screenshot({ path: "screenshots/admin-users.png", fullPage: true });

// --- Audit log -------------------------------------------------------------
await page.goto(`${base}/admin/audit-log`, { waitUntil: "domcontentloaded" });
const auditRows = await page.locator("table tbody tr").count();
log("audit rows", String(auditRows));
if (auditRows > 0) {
  log(
    "newest audit entry",
    (await page.locator("table tbody tr").first().innerText()).replace(/\n/g, " · ").slice(0, 120),
  );
}
await page.screenshot({ path: "screenshots/admin-audit.png", fullPage: true });

console.log(
  errors.length ? `console errors:\n${[...new Set(errors)].join("\n")}` : "no console errors",
);
await browser.close();
