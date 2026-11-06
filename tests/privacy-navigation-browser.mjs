// Read-only regression test. Run against a local build, or set SQ_WEB_ORIGIN.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.SQ_WEB_ORIGIN || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 780 } });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    const links = page.locator('a[href="/privacy"]:visible');
    await links.first().waitFor();
    assert.equal(await links.count(), width < 640 ? 1 : 2);
    if (width >= 640) {
      const box = await links.first().boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height < 100 && box.x > width / 2,
        "Desktop policy link must be reachable in the top-right without scrolling");
    }
    await links.first().click();
    await page.waitForURL(new URL("/privacy", origin).href);
    await page.getByRole("heading", { level: 1, name: "SQ-Link 개인정보처리방침" }).waitFor();
    console.log(`PASS anonymous privacy navigation: ${width}px`);
    await context.close();
  }
} finally {
  await browser.close();
}
