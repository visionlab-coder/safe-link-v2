import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.SAFE_LINK_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cookie = req.headers.get("cookie");
  if (!cookie) {
    return NextResponse.json({ sites: [] }, { status: 200 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/sites/options`, {
      headers: { cookie },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ sites: [] }, { status: 200 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ sites: [] }, { status: 200 });
  }

  const response = new NextResponse(await upstream.text(), {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}
