import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyV3Api(req, `/api/v1/system/sites/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
