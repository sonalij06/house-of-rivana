/** Walks a guest from a product page through add-to-bag, coupon and totals. */
import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const log = (step, detail) => console.log(`${step}: ${detail}`);

await page.goto(`${base}/product/aurelia-hoop-earrings`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /add to bag/i }).first().click();
await page.waitForTimeout(1500);

await page.goto(`${base}/cart`, { waitUntil: "networkidle" });
const readTotal = () => page.getByTestId("order-total").innerText();
log("cart total", await readTotal());

const lineCount = await page.locator("ul >> li").filter({ hasText: "Aurelia" }).count();
log("lines containing the product", String(lineCount));

// Quantity up, then verify the line total doubled.
await page.getByRole("button", { name: "Increase quantity" }).first().click();
await page.waitForTimeout(1600);
log("after qty increase", await readTotal());

async function applyCode(code) {
  const toggle = page.getByRole("button", { name: /promotion code/i });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Promotion code").fill(code);
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForTimeout(1800);
  const toast = page.locator("[data-sonner-toast]").first();
  return (await toast.isVisible().catch(() => false))
    ? (await toast.innerText()).replace(/\n/g, " | ")
    : "(no toast)";
}

// RIVANA500 needs ₹10,000; the bag is above it, so this must succeed.
log("RIVANA500", await applyCode("RIVANA500"));
log("total after ₹500 off", await readTotal());

await page.getByRole("button", { name: /remove/i }).last().click();
await page.waitForTimeout(1600);
log("total after removing coupon", await readTotal());

// A percent coupon capped at ₹2,000 must cap rather than take the full 10%.
log("WELCOME10", await applyCode("WELCOME10"));
log("total with WELCOME10", await readTotal());
log("code shown in summary", (await page.locator("body").innerText()).includes("WELCOME10") ? "yes" : "no");

await page.getByRole("button", { name: /remove/i }).last().click();
await page.waitForTimeout(1600);
log("NOTACODE rejected with", await applyCode("NOTACODE"));

await page.screenshot({ path: "screenshots/cart.png", fullPage: false });

// Guest cart must survive a login and merge into the account.
await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.getByLabel(/email/i).fill("ananya@example.com");
await page.getByLabel(/password/i).fill("Customer!2026");
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForTimeout(3000);
await page.goto(`${base}/cart`, { waitUntil: "networkidle" });
const afterLogin = await page.locator("body").innerText();
log("cart after login", afterLogin.includes("Aurelia") ? "guest cart merged" : "EMPTY — merge failed");
log("coupon after login", afterLogin.includes("WELCOME10") ? "kept" : "dropped");

if (errors.length) console.log("console errors:\n" + errors.slice(0, 8).join("\n"));
await browser.close();
