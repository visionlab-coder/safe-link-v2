import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return proxyV3Api(req, `/api/v1/admin/accounts/${encodeURIComponent(userId)}/reject`, {
    method: "POST",
  });
}
