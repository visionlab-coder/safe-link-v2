import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyV3Api(req, "/api/v1/chat/compat/admin/workers");
}
