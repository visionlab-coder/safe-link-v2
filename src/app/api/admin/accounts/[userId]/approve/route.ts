import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const body = await req.text();
  return proxyV3Api(req, `/api/v1/admin/accounts/${encodeURIComponent(userId)}/approve`, {
    method: "POST",
    body,
  });
}
