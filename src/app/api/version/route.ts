import { NextResponse } from "next/server";
import { createReleaseInfo } from "@/utils/release-info-core";

export const dynamic = "force-static";

export function GET() {
  // Keep literal process.env references so Next.js can inline the build identity
  // configured in next.config.ts for both Vercel and OpenNext builds.
  const releaseInfo = createReleaseInfo({
    NEXT_PUBLIC_SAFE_LINK_RELEASE_SHA:
      process.env.NEXT_PUBLIC_SAFE_LINK_RELEASE_SHA,
    NEXT_PUBLIC_SAFE_LINK_BUILD_TIME:
      process.env.NEXT_PUBLIC_SAFE_LINK_BUILD_TIME,
  });

  return NextResponse.json(releaseInfo, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
