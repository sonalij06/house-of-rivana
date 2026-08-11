/** Guest: product -> bag -> checkout -> UPI payment -> UTR -> order page. */
import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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

await page.goto(`${base}/checkout`, { waitUntil: "networkidle" });
log("checkout url", page.url());
log("checkout total", await page.getByTestId("order-total").innerText());

await page.locator("#email").fill("smoke.buyer@example.com");
await page.getByLabel("Full name").fill("Smoke Buyer");
await page.getByLabel("Mobile number").fill("9876500011");
await page.getByLabel("Flat, house, building").fill("14 Rosewood Apartments");
await page.getByLabel("Area, street, sector").fill("Bandra West");
await page.getByLabel("City").fill("Mumbai");
await page.getByLabel("State").selectOption("Maharashtra");
await page.getByLabel("PIN code").fill("400050");
await page.getByRole("button", { name: /wrap it as a gift/i }).click();

await page.getByRole("button", { name: /continue to/i }).click();
await page.waitForURL(/\/checkout\/payment\//, { timeout: 25000 });
log("payment url", page.url().replace(/t=[^&]+/, "t=***"));

const qrVisible = await page
  .getByRole("img", { name: /UPI QR code/i })
  .isVisible()
  .catch(() => false);
log("qr rendered", String(qrVisible));

const vpaRow = await page.locator("text=UPI ID").first().isVisible().catch(() => false);
log("upi id shown", String(vpaRow));
log("countdown", await page.locator("text=/Stock held/").first().innerText());

await page.getByRole("button", { name: /enter the reference/i }).click();
await page.waitForTimeout(600);

// A short UTR must be rejected by the server-side validation.
await page.getByLabel("UPI reference number (UTR)").fill("12345");
await page.getByRole("button", { name: /submit for verification/i }).click();
await page.waitForTimeout(1500);
const shortError = await page
  .locator('[role="alert"]')
  .first()
  .innerText()
  .catch(() => "(none)");
log("short utr rejected", shortError);

const utr = String(Date.now()).slice(-12);
await page.getByLabel("UPI reference number (UTR)").fill(utr);
await page.getByLabel("Your UPI ID").fill("smoke@okhdfcbank");
await page.getByRole("button", { name: /submit for verification/i }).click();
await page.waitForTimeout(3000);
log(
  "after submit",
  await page.locator("h2").first().innerText().catch(() => "(no heading)"),
);

await page.getByRole("link", { name: /view your order/i }).click();
await page.waitForURL(/\/order\//, { timeout: 20000 });
log("order url", page.url().replace(/t=[^&]+/, "t=***"));
log("order status", await page.locator("h1").first().innerText());
log(
  "payment status",
  await page.locator("dl").filter({ hasText: "Status" }).first().innerText().then((t) => t.replace(/\n/g, " | ")),
);
log("gift wrap noted", String(await page.locator("text=/Gift wrapped/").isVisible().catch(() => false)));
log("timeline entries", String(await page.locator("ol >> li").count()));

await page.screenshot({ path: "screenshots/checkout-order.png", fullPage: true });

// A stranger with no token must not see the order.
const anon = await browser.newContext();
const anonPage = await anon.newPage();
const orderNumber = page.url().split("/order/")[1].split("?")[0];
const response = await anonPage.goto(`${base}/order/${orderNumber}`, {
  waitUntil: "domcontentloaded",
});
log("anon order access", `${response.status()} -> ${anonPage.url().replace(base, "")}`);

console.log(
  errors.length ? `console errors:\n${[...new Set(errors)].join("\n")}` : "no console errors",
);
await browser.close();
