export const BASE_URL = (__ENV.K6_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
export const ORIGIN = (__ENV.K6_ORIGIN || "https://app.safe-link.co.kr").replace(/\/+$/, "");

export function integerEnv(name, fallback, minimum = 0, maximum = 10000) {
  const raw = __ENV[name];
  const parsed = raw === undefined || raw === "" ? fallback : Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function numberEnv(name, fallback, minimum = 0, maximum = 100000) {
  const raw = __ENV[name];
  const parsed = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be a number between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function durationEnv(name, fallback) {
  const value = __ENV[name] || fallback;
  if (!/^[1-9][0-9]*(?:ms|s|m|h)$/.test(value)) {
    throw new Error(`${name} must be a k6 duration such as 30s, 5m, or 1h`);
  }
  return value;
}

export function isProductionTarget() {
  const match = /^https?:\/\/([^/:?#]+)(?::[0-9]+)?(?:[/?#]|$)/i.exec(BASE_URL);
  if (!match) throw new Error(`K6_BASE_URL is invalid: ${BASE_URL}`);
  return match[1].toLowerCase() === "api.safe-link.co.kr";
}

export function requireProductionApproval() {
  if (isProductionTarget() && __ENV.K6_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Production load is blocked. Set K6_ALLOW_PRODUCTION=true only during an approved test window.",
    );
  }
}

export function enforceVuSafety(totalVus) {
  const hardLimit = integerEnv("K6_VU_HARD_LIMIT", 200, 1, 10000);
  if (totalVus > hardLimit && __ENV.K6_ALLOW_HIGH_LOAD !== "true") {
    throw new Error(
      `Requested ${totalVus} VUs exceeds the ${hardLimit} VU safety limit. ` +
        "Set K6_ALLOW_HIGH_LOAD=true only after capacity review.",
    );
  }
}

export function commonThresholds() {
  const failureRate = numberEnv("K6_MAX_FAILURE_RATE", 0.01, 0, 1);
  const p95Ms = integerEnv("K6_P95_MS", 800, 1, 60000);
  const checkRate = numberEnv("K6_MIN_CHECK_RATE", 0.99, 0, 1);
  return {
    checks: [`rate>${checkRate}`],
    http_req_failed: [`rate<${failureRate}`],
    http_req_duration: [`p(95)<${p95Ms}`],
  };
}

export function jsonParams(name, extraHeaders = {}) {
  return {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...extraHeaders,
    },
    tags: { name },
    redirects: 0,
    timeout: __ENV.K6_HTTP_TIMEOUT || "10s",
  };
}

export function queryString(values) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}
