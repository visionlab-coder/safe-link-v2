import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const configuredOrigin = process.env.SAFE_LINK_PUBLIC_APP_URL;
  const origin = configuredOrigin || new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/auth`);
}
