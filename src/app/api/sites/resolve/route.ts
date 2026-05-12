import { NextRequest, NextResponse } from "next/server";
import { createClient as createServer } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// POST /api/sites/resolve
// body: { name: string }
// 현장명으로 sites 테이블 조회 → 없으면 생성 → { id, name, created } 반환
// 로그인된 사용자 누구나 호출 가능 (프로필 등록 시 사용)

export async function POST(req: NextRequest) {
  const supa = await createServer();
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "name_too_short" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "name_too_long" }, { status: 400 });
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const service = createServiceClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 현장명으로 기존 현장 조회 (대소문자 무시)
  const { data: existing } = await service
    .from("sites")
    .select("id, name")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ id: existing.id, name: existing.name, created: false });
  }

  // 없으면 신규 생성
  const { data: created, error: insertErr } = await service
    .from("sites")
    .insert({ name, metadata: { created_by: user.id, source: "self_register" } })
    .select("id, name")
    .single();

  if (insertErr || !created) {
    return NextResponse.json(
      { error: "site_create_failed", detail: insertErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: created.id, name: created.name, created: true });
}
