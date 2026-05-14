import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { requireAdmin, type AdminContext } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function expiresAtEndOfSeoulDay(workDate: string): string {
  const nextDay = new Date(`${workDate}T15:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.toISOString();
}

const challengeRateMap = new Map<string, { count: number; resetAt: number }>();
const CHALLENGE_RATE_MAX = 10;
const CHALLENGE_RATE_WINDOW_MS = 60 * 1000;

function checkChallengeRate(userId: string): boolean {
  const now = Date.now();
  const entry = challengeRateMap.get(userId);
  if (entry && now < entry.resetAt) {
    if (entry.count >= CHALLENGE_RATE_MAX) return false;
    entry.count += 1;
  } else {
    challengeRateMap.set(userId, { count: 1, resetAt: now + CHALLENGE_RATE_WINDOW_MS });
  }
  return true;
}

function makeCode(): string {
  return String(randomInt(100000, 1000000));
}

async function getAdminSiteId(ctx: AdminContext) {
  const { data: profile } = await ctx.service
    .from("profiles")
    .select("site_id")
    .eq("id", ctx.user.id)
    .maybeSingle();
  return (profile as { site_id?: string | null } | null)?.site_id ?? null;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!checkChallengeRate(ctx.user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const siteId = await getAdminSiteId(ctx);
  if (!siteId) return NextResponse.json({ error: "profile_site_required" }, { status: 409 });

  const workDate = todayInSeoul();
  const { data, error } = await ctx.service
    .from("nfc_site_daily_challenges")
    .select("site_id, work_date, challenge_code, expires_at, created_at")
    .eq("site_id", siteId)
    .eq("work_date", workDate)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "challenge_query_failed" }, { status: 500 });
  return NextResponse.json({ challenge: data ?? null, work_date: workDate, site_id: siteId });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!checkChallengeRate(ctx.user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const siteId = await getAdminSiteId(ctx);
  if (!siteId) return NextResponse.json({ error: "profile_site_required" }, { status: 409 });

  let body: { rotate?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const workDate = todayInSeoul();
  const existing = await ctx.service
    .from("nfc_site_daily_challenges")
    .select("challenge_code")
    .eq("site_id", siteId)
    .eq("work_date", workDate)
    .eq("is_active", true)
    .maybeSingle();

  const code = body.rotate || !existing.data?.challenge_code ? makeCode() : existing.data.challenge_code;
  const { data, error } = await ctx.service
    .from("nfc_site_daily_challenges")
    .upsert({
      site_id: siteId,
      work_date: workDate,
      challenge_code: code,
      is_active: true,
      created_by: ctx.user.id,
      expires_at: expiresAtEndOfSeoulDay(workDate),
      metadata: { source: "admin_nfc_console", rotated: Boolean(body.rotate) },
    }, { onConflict: "site_id,work_date" })
    .select("site_id, work_date, challenge_code, expires_at, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "challenge_upsert_failed" }, { status: 500 });
  return NextResponse.json({ challenge: data });
}
