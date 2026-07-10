import "server-only";
import { cookies } from "next/headers";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

export type V3SessionUser = {
  id: number;
  email: string | null;
  displayName: string;
  preferredLanguage: string | null;
  roles: string[];
  siteIds: number[];
};

function buildCookieHeader(cookieStore: Awaited<ReturnType<typeof cookies>>): string {
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function getV3SessionUser(): Promise<V3SessionUser | null> {
  const cookieHeader = buildCookieHeader(await cookies());
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const user = (await response.json()) as Partial<V3SessionUser>;
    if (typeof user.id !== "number" || !Array.isArray(user.roles)) return null;

    return {
      id: user.id,
      email: typeof user.email === "string" ? user.email : null,
      displayName: typeof user.displayName === "string" ? user.displayName : "",
      preferredLanguage: typeof user.preferredLanguage === "string" ? user.preferredLanguage : null,
      roles: user.roles.map(String),
      siteIds: Array.isArray(user.siteIds) ? user.siteIds.map(Number).filter(Number.isFinite) : [],
    };
  } catch {
    return null;
  }
}
