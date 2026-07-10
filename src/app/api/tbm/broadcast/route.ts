import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyV3Api(req, "/api/v1/tbm/compat/broadcast", {
    method: "POST",
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body: await req.text(),
  });
}
