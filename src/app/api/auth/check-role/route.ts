import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "CHECK_ROLE_DISABLED",
      message: "Use /api/auth/me or Spring Boot /api/v1/auth/me for server-issued session role state.",
    },
    { status: 410 }
  );
}
