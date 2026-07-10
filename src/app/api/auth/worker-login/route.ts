import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "WORKER_MANUAL_LOGIN_DISABLED",
      message: "Worker login must use the V3 quick-login flow backed by Spring Boot sessions.",
    },
    { status: 410 }
  );
}
