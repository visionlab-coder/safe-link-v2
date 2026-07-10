import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const headers = new Headers();
  headers.set("X-Safe-Link-Origin", req.headers.get("origin") ?? req.nextUrl.origin);
  return proxyV3Api(req, `/api/v1/admin/workers/${encodeURIComponent(id)}/qr-token${req.nextUrl.search}`, {
    headers,
  });
}
