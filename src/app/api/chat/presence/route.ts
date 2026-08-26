import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userIds = req.nextUrl.searchParams.get("user_ids") ?? "";
  return proxyV3Api(req, `/api/v1/chat/compat/presence?user_ids=${encodeURIComponent(userIds)}`);
}

export async function POST(req: NextRequest) {
  return proxyV3Api(req, "/api/v1/chat/compat/presence", { method: "POST" });
}
