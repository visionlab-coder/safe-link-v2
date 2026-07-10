import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyV3Api(req, `/api/v1/glossary/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: await req.text(),
  });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyV3Api(req, `/api/v1/glossary/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
