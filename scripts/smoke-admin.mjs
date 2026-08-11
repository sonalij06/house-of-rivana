/** Admin: sign in, read the dashboard, verify a UPI payment, check settings. */
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

await page.goto(`${base}/admin/login`, { waitUntil: "domcontentloaded" });
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30000 });
log("admin url", page.url().replace(base, ""));
log("dashboard heading", await page.locator("h1").first().innerText());

const stats = await page.locator("section, div").locator("text=/Paid revenue/").count();
log("stat cards present", String(stats > 0));
log(
  "chart rendered",
  String(await page.locator("svg[role=img]").first().isVisible().catch(() => false)),
);
await page.screenshot({ path: "screenshots/admin-dashboard.png", fullPage: true });

// Verification queue.
await page.getByRole("link", { name: /verify payments/i }).first().click();
await page.waitForURL(/payments\/review/, { timeout: 20000 });
const cards = await page.locator("article").count();
log("payments awaiting review", String(cards));
await page.screenshot({ path: "screenshots/admin-review.png", fullPage: true });

if (cards > 0) {
  const first = page.locator("article").first();
  const orderNumber = await first.locator("a").first().innerText();
  await first.getByRole("button", { name: /confirm payment received/i }).click();
  await page.waitForTimeout(4000);
  log("verified", `${orderNumber} -> ${await first.innerText().then((t) => t.replace(/\n/g, " "))}`);
}

// Settings, including the provider toggle.
await page.goto(`${base}/admin/settings`, { waitUntil: "domcontentloaded" });
log("settings heading", await page.locator("h1").first().innerText());
const upi = await page.locator("#upiVpa").inputValue();
log("configured vpa", upi || "(empty)");

// Razorpay has no keys locally, so selecting it must be refused on save.
await page.getByRole("button", { name: /Razorpay/ }).click();
await page.getByRole("button", { name: /save settings/i }).click();
await page.waitForTimeout(2500);
log(
  "razorpay guard",
  await page.locator("[data-sonner-toast]").first().innerText().then((t) => t.replace(/\n/g, " | ")).catch(() => "(no toast)"),
);
await page.screenshot({ path: "screenshots/admin-settings.png", fullPage: true });

// A customer must not reach the admin.
const cust = await browser.newContext();
const custPage = await cust.newPage();
const res = await custPage.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
log("anon admin access", `${res.status()} -> ${custPage.url().replace(base, "")}`);

console.log(
  errors.length ? `console errors:\n${[...new Set(errors)].join("\n")}` : "no console errors",
);
await browser.close();
