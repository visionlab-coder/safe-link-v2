import { chromium } from "playwright-core";

const baseUrl = process.env.SAFE_LINK_QA_BASE_URL || "http://127.0.0.1:3100";
const executablePath = process.env.CHROME_EXECUTABLE_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    connectionType: "cellular3g",
  });

  let resetRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/auth/password-reset/request")) {
      resetRequests += 1;
    }
  });

  const startedAt = Date.now();
  await page.goto(`${baseUrl}/auth/reset-password`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((node) => node.textContent?.includes("재설정 안내 요청"));
    return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactProps")));
  }, undefined, { timeout: 45_000 });
  await emailInput.fill("slow-3g-qa@example.com");
  const submit = page.getByRole("button", { name: "재설정 안내 요청" });
  await submit.click();
  const disabledDuringRequest = await submit.isDisabled();
  await page.getByRole("status").waitFor({ state: "visible", timeout: 45_000 });
  const message = await page.getByRole("status").innerText();

  const passed = disabledDuringRequest
    && resetRequests === 1
    && message.includes("등록 여부와 관계없이");
  console.log(JSON.stringify({
    passed,
    elapsedMs: Date.now() - startedAt,
    disabledDuringRequest,
    resetRequests,
    message,
  }));
  if (!passed) process.exitCode = 1;
} finally {
  await browser.close();
}
