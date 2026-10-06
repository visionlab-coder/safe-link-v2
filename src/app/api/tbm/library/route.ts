import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyV3Api(request, "/api/v1/tbm/library");
}
