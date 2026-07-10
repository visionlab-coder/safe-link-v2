import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyV3Api(req, "/api/v1/quiz/send", {
    method: "POST",
    body: await req.text(),
  });
}
