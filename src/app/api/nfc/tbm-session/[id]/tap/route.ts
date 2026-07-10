import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const headers = new Headers();
  headers.set("X-Safe-Link-Origin", req.headers.get("origin") ?? req.nextUrl.origin);
  return proxyV3Api(req, `/api/v1/admin/nfc/tbm-session/${encodeURIComponent(id)}/tap`, {
    method: "POST",
    headers,
    body: await req.text(),
  });
}
