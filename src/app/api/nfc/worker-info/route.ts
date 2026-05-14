import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NFC_BASE_URL } from "@/utils/nfc/constants";
import { parseStickerUrl, verifyStickerSignature } from "@/utils/nfc/signing";

export const runtime = "nodejs";

/**
 * GET /api/nfc/worker-info?url=<signed-nfc-url>
 *
 * NFC 서명 검증 후 근로자의 국가 선택 여부를 반환.
 * nationality_confirmed_at IS NULL → 최초 진입 → 국가 선택 UI 표시 필요
 * nationality_confirmed_at NOT NULL → 재진입 → 자동 로그인 가능
 */
export async function GET(req: NextRequest) {
    const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
    const parsed = parseStickerUrl(rawUrl, NFC_BASE_URL) ?? parseStickerUrl(rawUrl, req.nextUrl.origin);
    if (!parsed) return NextResponse.json({ error: "url_malformed_or_spoofed" }, { status: 400 });

    const service = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    let workerId = parsed.workerId;
    if (!workerId && parsed.workerCode) {
        const { data: w } = await service
            .from("nfc_workers")
            .select("id")
            .eq("worker_code", parsed.workerCode)
            .maybeSingle();
        workerId = w?.id;
    }
    if (!workerId) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
    if (!parsed.issuedEpoch) return NextResponse.json({ error: "issued_epoch_required" }, { status: 400 });

    const sigOk = await verifyStickerSignature({ ...parsed, workerId });
    if (!sigOk) return NextResponse.json({ error: "signature_invalid" }, { status: 401 });

    const { data: sticker } = await service
        .from("nfc_worker_stickers")
        .select("is_active")
        .eq("worker_id", workerId)
        .eq("sig_version", parsed.sigVersion)
        .eq("issued_epoch", parsed.issuedEpoch)
        .maybeSingle();
    if (!sticker?.is_active) return NextResponse.json({ error: "sticker_revoked_or_missing" }, { status: 401 });

    const { data: worker } = await service
        .from("nfc_workers")
        .select("nationality, preferred_lang, nationality_confirmed_at, assigned_site_id")
        .eq("id", workerId)
        .eq("is_active", true)
        .single();

    if (!worker) return NextResponse.json({ error: "worker_inactive" }, { status: 403 });

    // 오늘의 챌린지 코드 자동 조회 — 클라이언트가 수동 입력 불필요
    let siteChallengeCode: string | null = null;
    if (worker.assigned_site_id) {
        const todaySeoul = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        const { data: challenge } = await service
            .from("nfc_site_daily_challenges")
            .select("challenge_code, expires_at")
            .eq("site_id", worker.assigned_site_id)
            .eq("work_date", todaySeoul)
            .eq("is_active", true)
            .maybeSingle();
        if (challenge && new Date(challenge.expires_at).getTime() > Date.now()) {
            siteChallengeCode = String(challenge.challenge_code);
        }
    }

    return NextResponse.json({
        has_confirmed: Boolean(worker.nationality_confirmed_at),
        nationality: worker.nationality,
        preferred_lang: worker.preferred_lang,
        site_challenge_code: siteChallengeCode,
    });
}
