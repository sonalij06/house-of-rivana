/**
 * Screenshot helper used while building out pages.
 *   node scripts/shot.mjs /shop shop.png [--full] [--mobile]
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const [path = "/", name = "shot.png", ...flags] = process.argv.slice(2);
const full = flags.includes("--full");
const mobile = flags.includes("--mobile");

await mkdir("screenshots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await context.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

const response = await page.goto(`http://localhost:3000${path}`, {
  waitUntil: "networkidle",
  timeout: 60_000,
});

// Let scroll-triggered reveals settle before capturing a full-page shot.
if (full) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight * 0.8;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 130);
        else {
          window.scrollTo(0, 0);
          setTimeout(resolve, 400);
        }
      };
      step();
    });
  });
}
const scrollFlag = flags.find((f) => f.startsWith("--scroll="));
if (scrollFlag) {
  const target = Number(scrollFlag.split("=")[1]);
  await page.evaluate(async (y) => {
    // Step down so whileInView reveals fire on the way, then settle at y.
    for (let current = 0; current < y; current += window.innerHeight * 0.7) {
      window.scrollTo(0, current);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, y);
  }, target);
  await page.waitForTimeout(900);
}

await page.waitForTimeout(1200);

await page.screenshot({ path: `screenshots/${name}`, fullPage: full });
console.log(`status=${response?.status()} -> screenshots/${name}`);
if (errors.length) console.log("console errors:\n" + errors.slice(0, 10).join("\n"));

await browser.close();
