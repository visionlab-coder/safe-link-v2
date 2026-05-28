import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs", "generated", "real-screens");
fs.mkdirSync(OUT, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  path.join(
    process.env.LOCALAPPDATA || "",
    "ms-playwright",
    "chromium_headless_shell-1208",
    "chrome-headless-shell-win64",
    "chrome-headless-shell.exe",
  ),
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => fs.existsSync(p));
if (!chromePath) throw new Error("No Chromium/Chrome/Edge executable found");
const baseUrl = process.env.SAFE_LINK_BASE_URL || "http://localhost:3001";
const email = process.env.SAFE_LINK_TRAINING_EMAIL || "training-admin@safe-link.local";
const password = process.env.SAFE_LINK_TRAINING_PASSWORD || "SafeLink!2026";
const port = Number(process.env.CDP_PORT || 9223);
const profile = path.join(os.tmpdir(), `safe-link-cdp-${Date.now()}`);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
    this.ws.on("message", (buf) => {
      const msg = JSON.parse(buf.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 90000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function waitForChrome() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const version = await getJson(`http://127.0.0.1:${port}/json/version`);
      if (version.webSocketDebuggerUrl) return;
    } catch {}
    await wait(250);
  }
  throw new Error("Chrome did not expose CDP");
}

async function connectPage() {
  const tabs = await getJson(`http://127.0.0.1:${port}/json`);
  const page = tabs.find((t) => t.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("No page target");
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return cdp;
}

async function nav(cdp, url, settle = 2500) {
  await cdp.send("Page.navigate", { url });
  await wait(settle);
}

async function evalJs(cdp, expression, awaitPromise = true) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function shot(cdp, name) {
  await wait(1200);
  const scrollY = await evalJs(cdp, "window.scrollY || 0");
  const data = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    optimizeForSpeed: true,
    clip: { x: 0, y: Number(scrollY) || 0, width: 1440, height: 980, scale: 1 },
    captureBeyondViewport: false,
  });
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data.data, "base64"));
  console.log(file);
}

async function login(cdp) {
  await nav(cdp, `${baseUrl}/auth?lang=ko&role=admin`, 3500);
  await shot(cdp, "01-auth-admin-login");
  const info = await evalJs(
    cdp,
    `(() => Array.from(document.querySelectorAll('input')).map((el, i) => ({i, type: el.type, placeholder: el.placeholder, value: el.value})))()`,
  );
  console.log(JSON.stringify({ inputs: info }, null, 2));
  const ok = await evalJs(
    cdp,
    `(async () => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const emailInput = inputs.find(i => i.type === 'email' || /email|이메일/i.test(i.placeholder || '')) || inputs[0];
      const passInput = inputs.find(i => i.type === 'password') || inputs[1];
      function setValue(el, value) {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        desc.set.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setValue(emailInput, ${JSON.stringify(email)});
      setValue(passInput, ${JSON.stringify(password)});
      await new Promise(r => setTimeout(r, 300));
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginBtn = buttons.find(b => /로그인|login|시작|enter/i.test(b.textContent || '')) || buttons[buttons.length - 1];
      loginBtn.click();
      return { button: loginBtn?.textContent, inputs: inputs.length };
    })()`,
  );
  console.log(JSON.stringify({ loginClick: ok }, null, 2));
  await wait(6500);
}

const routes = [
  ["02-admin-dashboard", "/admin?lang=ko"],
  ["03-profile-setup", "/auth/setup?lang=ko"],
  ["04-tbm-create", "/admin/tbm/create?lang=ko"],
  ["04a-tbm-filled", "/admin/tbm/create?lang=ko"],
  ["05-tbm-status", "/admin/tbm/status?lang=ko"],
  ["06-chat", "/admin/chat?lang=ko"],
  ["07-workers", "/admin/workers?lang=ko"],
  ["08-workers-enroll", "/admin/workers/enroll?lang=ko"],
  ["09-nfc", "/admin/nfc?lang=ko"],
  ["10-qr-code", "/admin/qrcode?lang=ko"],
  ["11-quiz", "/admin/quiz?lang=ko"],
  ["12-esg", "/admin/esg?lang=ko"],
  ["13-glossary", "/admin/glossary?lang=ko"],
  ["14-live", "/admin/live?lang=ko"],
];

async function enrichCurrentScreen(cdp, name) {
  if (name === "04-tbm-create" || name === "04a-tbm-filled") {
    await evalJs(
      cdp,
      `(async () => {
        const sample = "3층 철근 양중 작업 TBM\\n- 크레인 작업 반경 5m 이내 접근 금지\\n- 안전고리 체결 후 작업 시작\\n- 신호수 지시 전 자재 하부 통과 금지\\n- 낙하물 위험 구역 통제선 설치 확인";
        const inputs = Array.from(document.querySelectorAll('input'));
        const category = inputs.find(i => /카테고리|거푸집|비계|타설|category/i.test(i.placeholder || '')) || inputs[0];
        if (category) {
          const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          desc.set.call(category, '철근 양중 / 고소작업');
          category.dispatchEvent(new Event('input', { bubbles: true }));
          category.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const area = document.querySelector('textarea');
        if (area) {
          const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
          desc.set.call(area, sample);
          area.dispatchEvent(new Event('input', { bubbles: true }));
          area.dispatchEvent(new Event('change', { bubbles: true }));
          area.scrollIntoView({ block: 'center' });
        }
        window.scrollTo({ top: name === "04a-tbm-filled" ? 760 : 320, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 1000));
        return true;
      })()`.replaceAll("name ===", JSON.stringify(name) + " ==="),
    );
  }
  if (name === "06-chat") {
    await evalJs(
      cdp,
      `(async () => {
        await new Promise(r => setTimeout(r, 1000));
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], div'));
        const worker = candidates.find(el => /Nguyen|김민수|Somchai|Rustam/i.test(el.textContent || ''));
        if (worker) worker.click();
        await new Promise(r => setTimeout(r, 2500));
        return worker ? worker.textContent : null;
      })()`,
    );
  }
  if (name === "12-esg") {
    await evalJs(
      cdp,
      `(async () => {
        await new Promise(r => setTimeout(r, 1000));
        const btn = Array.from(document.querySelectorAll('button')).find(b => /조회|생성|report|리포트/i.test(b.textContent || ''));
        if (btn) btn.click();
        await new Promise(r => setTimeout(r, 3500));
        return btn ? btn.textContent : null;
      })()`,
    );
  }
}

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--headless=new",
  "--disable-gpu-sandbox",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1440,980",
  "about:blank",
]);

chrome.stderr.on("data", (d) => process.stderr.write(d));

try {
  await waitForChrome();
  const cdp = await connectPage();
  await login(cdp);
  for (const [name, route] of routes) {
    await nav(cdp, `${baseUrl}${route}`, 3800);
    await enrichCurrentScreen(cdp, name);
    await shot(cdp, name);
  }
  cdp.close();
} finally {
  chrome.kill();
}
