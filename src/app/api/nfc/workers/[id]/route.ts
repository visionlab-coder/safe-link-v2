import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyV3Api(req, `/api/v1/admin/workers/${encodeURIComponent(id)}`);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyV3Api(req, `/api/v1/admin/workers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: await req.text(),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyV3Api(req, `/api/v1/admin/workers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
