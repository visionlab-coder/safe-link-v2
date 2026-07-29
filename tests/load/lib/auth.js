import http from "k6/http";
import { check, fail } from "k6";
import { BASE_URL, jsonParams } from "./config.js";

function parseJsonArray(name) {
  const raw = __ENV[name];
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be a JSON array`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${name} must be a JSON array`);
  return parsed;
}

function accountsFromFile() {
  const path = __ENV.K6_ACCOUNTS_FILE;
  if (!path) return null;
  let parsed;
  try {
    parsed = JSON.parse(open(path));
  } catch {
    throw new Error(`K6_ACCOUNTS_FILE could not be read as JSON: ${path}`);
  }
  if (!Array.isArray(parsed.admins) || !Array.isArray(parsed.workers)) {
    throw new Error("K6_ACCOUNTS_FILE requires admins and workers arrays");
  }
  return parsed;
}

const ACCOUNT_FILE = accountsFromFile();
export const ADMIN_ACCOUNTS =
  ACCOUNT_FILE?.admins || parseJsonArray("K6_ADMIN_ACCOUNTS_JSON");
export const WORKER_ACCOUNTS =
  ACCOUNT_FILE?.workers || parseJsonArray("K6_WORKER_ACCOUNTS_JSON");

export function requireAccounts(adminVus, workerVus) {
  if (adminVus > 0 && ADMIN_ACCOUNTS.length === 0) {
    throw new Error(
      "K6_ADMIN_ACCOUNTS_JSON is required when K6_ADMIN_VUS is greater than 0",
    );
  }
  if (workerVus > 0 && WORKER_ACCOUNTS.length === 0) {
    throw new Error(
      "K6_WORKER_ACCOUNTS_JSON is required when K6_WORKER_VUS is greater than 0",
    );
  }
}

export function accountForVu(accounts) {
  return accounts[(__VU - 1) % accounts.length];
}

export function loginAdmin(account) {
  if (!account?.email || !account?.password) {
    fail("admin account requires email and password");
  }
  const response = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: account.email, password: account.password }),
    jsonParams("POST /api/v1/auth/login"),
  );
  const ok = check(response, {
    "admin login is 200": (result) => result.status === 200,
    "admin login has roles": (result) => {
      try {
        return Array.isArray(result.json("roles"));
      } catch {
        return false;
      }
    },
  });
  if (!ok) fail(`admin login failed with status ${response.status}`);
  return response.json();
}

export function loginWorker(account) {
  if (!account?.name_initials || !account?.phone_last4) {
    fail("worker account requires name_initials and phone_last4");
  }
  const response = http.post(
    `${BASE_URL}/api/v1/auth/worker-quick-login`,
    JSON.stringify({
      name_initials: account.name_initials,
      phone_last4: account.phone_last4,
      preferred_lang: account.preferred_lang || "ko",
      ...(account.site_id ? { site_id: String(account.site_id) } : {}),
    }),
    jsonParams("POST /api/v1/auth/worker-quick-login"),
  );
  const ok = check(response, {
    "worker login is 200": (result) => result.status === 200,
    "worker login has WORKER role": (result) => {
      try {
        return result.json("roles").includes("WORKER");
      } catch {
        return false;
      }
    },
  });
  if (!ok) fail(`worker login failed with status ${response.status}`);
  return response.json();
}
