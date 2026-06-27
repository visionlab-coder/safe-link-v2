import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const baseUrl = process.env.SAFE_LINK_BASE_URL || "http://127.0.0.1:3001";
const OUT = path.join(ROOT, "docs", "generated", "actual-app-captures-20260601");
const PATENT_OUT = path.join(ROOT, "docs", "generated", "patent-claim-app-captures-20260601");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PATENT_OUT, { recursive: true });

const adminEmail = process.env.SAFE_LINK_TRAINING_EMAIL || "training-admin@safe-link.local";
const password = process.env.SAFE_LINK_TRAINING_PASSWORD || "SafeLink!2026";
const workerPhone = "01010002002";
const workerName = "Nguyen An";
const workerLang = "vi";
const port = Number(process.env.CDP_PORT || 9241);
const profile = path.join(os.tmpdir(), `safe-link-actual-captures-${Date.now()}`);

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => fs.existsSync(p));
if (!chromePath) throw new Error("No Chrome or Edge executable found");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1].trim()] = value;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
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
    this.ws.on("message", (buf) => {
      const msg = JSON.parse(buf.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
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
      }, 60000);
      this.pending.set(id, { resolve, reject, timer });
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
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  return cdp;
}

async function evalJs(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function nav(cdp, url, settle = 2600) {
  await cdp.send("Page.navigate", { url });
  await wait(settle);
}

function parseSetCookie(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,]+=)/).map((part) => {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
  }).filter((cookie) => cookie.name && cookie.value);
}

async function loginByHttp(endpoint, body) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} failed ${res.status}: ${text}`);
  return parseSetCookie(res.headers.get("set-cookie"));
}

async function setBrowserCookies(cdp, cookies) {
  for (const cookie of cookies) {
    const result = await cdp.send("Network.setCookie", {
      url: baseUrl,
      name: cookie.name,
      value: cookie.value,
      path: "/",
    });
    if (result.success === false) throw new Error(`failed to set cookie ${cookie.name}`);
    await evalJs(
      cdp,
      `document.cookie = ${JSON.stringify(`${cookie.name}=${cookie.value}; path=/; max-age=3600; SameSite=Lax`)}`,
    );
  }
  await evalJs(cdp, `sessionStorage.setItem("safe-link-session-active", "true")`);
  const check = await evalJs(
    cdp,
    `(async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      return { status: res.status, cookie: document.cookie.slice(0, 80), text: await res.text() };
    })()`,
  );
  if (check.status !== 200) {
    throw new Error(`browser auth check failed: ${JSON.stringify(check)}`);
  }
}

async function waitForAppReady(cdp, timeout = 12000) {
  const started = Date.now();
  let body = "";
  while (Date.now() - started < timeout) {
    body = await evalJs(cdp, "document.body.innerText || ''");
    if (
      !/세션 확인 중|로딩|Loading|확인 중입니다|처리 중입니다/.test(body) &&
      body.trim().length > 30
    ) {
      return body;
    }
    await wait(700);
  }
  return body;
}

async function shot(cdp, name) {
  await wait(900);
  await waitForAppReady(cdp);
  await evalJs(cdp, "window.scrollTo(0, 0)");
  const data = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data.data, "base64"));
  console.log(file);
  return file;
}

async function ensureDemoWorker() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: sites } = await service.from("sites").select("id").limit(1);
  const siteId = sites?.[0]?.id ?? null;

  const { data: existing } = await service
    .from("nfc_workers")
    .select("id")
    .eq("phone", workerPhone)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    await service.from("nfc_workers").insert({
      full_name: workerName,
      nationality: "VN",
      phone: workerPhone,
      assigned_site_id: siteId,
      preferred_lang: workerLang,
      trade: "formwork",
      name_initials: "NA",
      phone_last4: "2002",
      is_active: true,
    });
  }

  const { data: latestTbm } = await service
    .from("nfc_tbm_sessions")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latestTbm?.id ?? null;
}

function copyForPatent(sourceName, claim, destTitle) {
  const source = path.join(OUT, `${sourceName}.png`);
  if (!fs.existsSync(source)) return null;
  const safe = destTitle.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
  const dest = path.join(PATENT_OUT, `${claim}_${safe}.png`);
  fs.copyFileSync(source, dest);
  return path.basename(dest);
}

async function main() {
  const tbmId = await ensureDemoWorker();
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,980",
    `${baseUrl}/`,
  ]);

  try {
    await waitForChrome();
    const cdp = await connectPage();
    await nav(cdp, `${baseUrl}/`, 1800);
    await shot(cdp, "00_home");

    await nav(cdp, `${baseUrl}/auth?lang=ko`, 2200);
    await shot(cdp, "01_auth_role_select");
    await setBrowserCookies(cdp, await loginByHttp("/api/auth/admin-login", { email: adminEmail, password }));

    const adminRoutes = [
      ["02_admin_dashboard", "/admin?lang=ko"],
      ["03_admin_tbm_create", "/admin/tbm/create?lang=ko"],
      ["04_admin_tbm_status", "/admin/tbm/status?lang=ko"],
      ["05_admin_chat", "/admin/chat?lang=ko"],
      ["06_admin_workers", "/admin/workers?lang=ko"],
      ["07_admin_workers_enroll", "/admin/workers/enroll?lang=ko"],
      ["08_admin_nfc", "/admin/nfc?lang=ko"],
      ["09_admin_qrcode", "/admin/qrcode?lang=ko"],
      ["10_admin_quiz", "/admin/quiz?lang=ko"],
      ["11_admin_esg", "/admin/esg?lang=ko"],
      ["12_admin_glossary", "/admin/glossary?lang=ko"],
      ["13_admin_live", "/admin/live?lang=ko"],
    ];
    for (const [name, route] of adminRoutes) {
      await nav(cdp, `${baseUrl}${route}`, 2600);
      await shot(cdp, name);
    }

    await cdp.send("Network.clearBrowserCookies");
    await nav(cdp, `${baseUrl}/auth?lang=ko`, 1600);
    await setBrowserCookies(cdp, await loginByHttp("/api/auth/worker-login", { phoneNumber: workerPhone, displayName: workerName, lang: workerLang }));

    const workerRoutes = [
      ["14_worker_dashboard", "/worker?lang=vi"],
      ["15_worker_chat", "/worker/chat?lang=vi"],
      ["16_worker_live", "/worker/live?lang=vi"],
      ["17_worker_quiz", "/worker/quiz?lang=vi"],
      ["18_worker_pledge", "/worker/pledge?lang=vi"],
      ["19_worker_vision", "/worker/vision?lang=vi"],
    ];
    if (tbmId) workerRoutes.splice(1, 0, ["14a_worker_tbm_detail", `/worker/tbm/${tbmId}?lang=vi`]);
    for (const [name, route] of workerRoutes) {
      await nav(cdp, `${baseUrl}${route}`, 3200);
      await shot(cdp, name);
    }

    const claimMap = [
      ["02_admin_dashboard", "C1", "시스템_기본_구성_관리자대시보드"],
      ["08_admin_nfc", "C2", "NFC_QR_검증매체"],
      ["08_admin_nfc", "C3", "다매체_매핑_재발급"],
      ["04_admin_tbm_status", "C4", "TBM_세션_유효성_서명현황"],
      ["03_admin_tbm_create", "C5", "위험성평가_TBM_작성"],
      ["13_admin_live", "C6", "원문_번역_실시간통역"],
      ["05_admin_chat", "C7", "다국어_1대1_채팅"],
      ["10_admin_quiz", "C8", "퀴즈_이수_분류"],
      ["18_worker_pledge", "C9", "안전약속_전자서명"],
      ["11_admin_esg", "C10", "보고서_해시_무결성"],
      ["09_admin_qrcode", "C11", "QR_검증_URL"],
      ["19_worker_vision", "C12", "작업중지_안전신고_근로자"],
      ["11_admin_esg", "C13", "ESG_이력집계"],
      ["14a_worker_tbm_detail", "C14", "근로자_TBM_방법청구"],
      ["15_worker_chat", "C15", "안전대화_로그"],
    ];
    const readme = [
      "# SAFE-LINK v2.0 실제 앱 캡처 기반 특허 이미지",
      "",
      "생성일: 2026-06-01",
      "",
      "| 청구항 | 실제 앱 캡처 파일 | 대응 기능 |",
      "| --- | --- | --- |",
    ];
    for (const [source, claim, title] of claimMap) {
      const file = copyForPatent(source, claim, title);
      if (file) readme.push(`| ${claim} | ${file} | ${title.replaceAll("_", " ")} |`);
    }
    fs.writeFileSync(path.join(PATENT_OUT, "README.md"), `${readme.join("\n")}\n`, "utf8");
    cdp.close();
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
