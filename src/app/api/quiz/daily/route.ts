import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// POST /api/quiz/daily
// 오늘의 TBM 기반 3문제를 자동 생성하고 해당 현장 근로자 전원에게 발송.
// TBM이 없으면 fallback 예시 문제 사용.
// 관리자 버튼 또는 외부 cron(예: cron-job.org)으로 호출.

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { service, user } = guard.ctx;

  // 요청자 현장 확인
  const { data: profile } = await service
    .from("profiles")
    .select("site_id")
    .eq("id", user.id)
    .maybeSingle();

  const siteId = profile?.site_id ?? null;

  // 오늘 날짜 기준 최신 TBM 세션 조회 (현장 필터)
  let tbmQuery = service
    .from("nfc_tbm_sessions")
    .select("id, title, site_id")
    .order("started_at", { ascending: false })
    .limit(1);
  if (siteId) tbmQuery = tbmQuery.eq("site_id", siteId);
  const { data: latestTbm } = await tbmQuery.maybeSingle();

  const tbmSessionId = latestTbm?.id ?? null;

  // quiz/generate 내부 호출 (서버 to 서버)
  const origin = req.nextUrl.origin;
  const generateRes = await fetch(`${origin}/api/quiz/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 서비스롤 세션 쿠키 전달
      Cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ tbmSessionId, maxQuestions: 3 }),
  });

  if (!generateRes.ok) {
    const err = await generateRes.json().catch(() => ({}));
    return NextResponse.json({ error: "generate_failed", detail: err }, { status: 500 });
  }

  const generated = await generateRes.json();
  const quizSessionId = generated.quizSessionId;

  if (!quizSessionId) {
    return NextResponse.json({
      ok: true,
      generated: true,
      sent: false,
      reason: "no_quiz_session_id",
      source: generated.source,
      questions: generated.questions,
    });
  }

  // quiz/send 내부 호출
  const sendRes = await fetch(`${origin}/api/quiz/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ quizSessionId, tbmSessionId }),
  });

  const sendData = await sendRes.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    generated: true,
    sent: sendRes.ok,
    tbmSessionId,
    quizSessionId,
    source: generated.source,
    sentCount: sendData.sent ?? 0,
    error: sendRes.ok ? undefined : sendData.error,
  });
}
