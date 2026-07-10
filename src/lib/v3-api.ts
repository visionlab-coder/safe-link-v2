const DEFAULT_API_BASE_URL = "http://localhost:8080";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const SAFE_LINK_V3_API_BASE_URL =
  process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || DEFAULT_API_BASE_URL;

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = readBrowserCookie("XSRF-TOKEN");
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  const response = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { token?: string };
  return data.token ?? readBrowserCookie("XSRF-TOKEN");
}

export async function v3ApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (!SAFE_METHODS.has(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) headers.set("X-XSRF-TOKEN", csrf);
  }
  return fetch(`${SAFE_LINK_V3_API_BASE_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
}
