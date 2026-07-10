import { NextRequest, NextResponse } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyV3Api(req, `/api/v1/pledges/hash-chain${req.nextUrl.search}`);
}

export async function POST() {
  return NextResponse.json({ error: "hash_chain_append_must_use_domain_api" }, { status: 405 });
}
