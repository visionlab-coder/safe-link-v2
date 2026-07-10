import { NextRequest, NextResponse } from "next/server";
import { checkWorkerLoginLimit } from "@/utils/rate-limit";
import { isMobileClient, withMobileCors, handleMobilePreflight } from "@/utils/auth/mobile-cors";

export const runtime = "nodejs";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

export async function OPTIONS(req: NextRequest) {
  return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!(await checkWorkerLoginLimit(ip))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: {
    name_initials?: unknown;
    phone_last4?: unknown;
    preferred_lang?: unknown;
    site_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const nameInitials = String(body.name_initials ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  const phoneLast4 = String(body.phone_last4 ?? "").replace(/\D/g, "").slice(-4);
  const preferredLang = /^[a-z]{2,5}$/i.test(String(body.preferred_lang ?? ""))
    ? String(body.preferred_lang).toLowerCase()
    : "ko";
  const siteId = body.site_id == null || body.site_id === ""
    ? null
    : String(body.site_id).trim();

  if (!nameInitials) return NextResponse.json({ error: "INITIALS_REQUIRED" }, { status: 400 });
  if (phoneLast4.length !== 4) return NextResponse.json({ error: "PHONE_LAST4_REQUIRED" }, { status: 400 });

  const upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/worker-quick-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      name_initials: nameInitials,
      phone_last4: phoneLast4,
      preferred_lang: preferredLang,
      ...(siteId ? { site_id: siteId } : {}),
    }),
    cache: "no-store",
  });

  const response = new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }

  return isMobileClient(req) ? withMobileCors(response, req.headers.get("origin")) : response;
}
