const baseUrl = process.env.SAFE_LINK_BASE_URL || "http://127.0.0.1:3001";
const email = process.env.SAFE_LINK_TRAINING_EMAIL || "training-admin@safe-link.local";
const password = process.env.SAFE_LINK_TRAINING_PASSWORD || "SafeLink!2026";

const jar = new Map();

function storeCookies(res) {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  for (const part of setCookie.split(/,(?=\s*[^;,]+=)/)) {
    const [pair] = part.split(";");
    const [name, value] = pair.split("=");
    if (name && value) jar.set(name.trim(), value.trim());
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(label, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers: {
      ...(cookieHeader() ? { cookie: cookieHeader() } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  storeCookies(res);
  const text = await res.text();
  const ok = res.status >= 200 && res.status < 400;
  console.log(JSON.stringify({ label, status: res.status, ok, bytes: text.length }));
  if (!ok) {
    console.log(text.slice(0, 500));
  }
  return { res, text, ok };
}

await request("home", "/");
await request("auth-page", "/auth?lang=ko&role=admin");

const login = await request("admin-login", "/api/auth/admin-login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});

if (!login.ok) {
  process.exitCode = 1;
  throw new Error("admin login failed");
}

await request("auth-me", "/api/auth/me");
await request("admin-dashboard", "/admin?lang=ko");
await request("admin-live-page", "/admin/live?lang=ko");
await request("admin-quiz-page", "/admin/quiz?lang=ko");

const quiz = await request("quiz-generate-fallback", "/api/quiz/generate", {
  method: "POST",
  body: JSON.stringify({ maxQuestions: 1 }),
});
if (!quiz.ok) {
  process.exitCode = 1;
  throw new Error("quiz generate fallback failed");
}

jar.clear();
await request("after-cookie-clear-auth-me", "/api/auth/me");
