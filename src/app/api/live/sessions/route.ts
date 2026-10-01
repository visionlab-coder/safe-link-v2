import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyV3Api(req, `/api/v1/live/sessions${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  const response = await proxyV3Api(req, "/api/v1/live/sessions", {
    method: "POST",
    body: await req.text(),
  });
  if (!response.ok) {
    console.error("[TBM live proxy] session start failed", { status: response.status });
  }
  return response;
}

export async function DELETE(req: NextRequest) {
  return proxyV3Api(req, `/api/v1/live/sessions${req.nextUrl.search}`, {
    method: "DELETE",
  });
}
