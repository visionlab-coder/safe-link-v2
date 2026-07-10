import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyV3Api(req, `/api/v1/admin/nfc/tbm-session/${encodeURIComponent(id)}/notify`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyV3Api(req, `/api/v1/admin/nfc/tbm-session/${encodeURIComponent(id)}/notify`, {
    method: "POST",
  });
}
