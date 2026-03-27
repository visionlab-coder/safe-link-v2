import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage } from '@/utils/errors';

interface SiteBriefingRequest {
    role?: string;
    lang?: string;
}

interface GeminiBriefingResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
}

/**
 * 🟡 Site Briefing Agent API (Tier 2)
 * 현장 데이터(TBM 이행률, 소음, 채팅 로그 등)를 취합하여 AI가 관리자에게 전략적 요약을 제공합니다.
 */
export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    try {
        const { lang = "ko" } = await request.json() as SiteBriefingRequest;
        const supabase = await createClient();

        // 인증 + 서버 측 role 확인 (클라이언트 제공 role 무시)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, site_id')
            .eq('id', user.id)
            .single();
        if (!profile) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const role = profile.role as string;
        const adminSiteId = profile.site_id as string | null;

        // 1. 현장 데이터 취합 (최근 24시간)
        // [TBM 현황] — 본사 관리자(site_id 없음)는 전체, 현장 관리자는 자기 현장만
        let workerCountQuery = supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'WORKER');
        if (adminSiteId) workerCountQuery = workerCountQuery.eq('site_id', adminSiteId);
        const { count: totalWorkers } = await workerCountQuery;

        let tbmQuery = supabase
            .from('tbm_notices')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        if (adminSiteId) tbmQuery = tbmQuery.eq('site_id', adminSiteId);
        const { data: recentTBM } = await tbmQuery.single();

        let ackCount = 0;
        if (recentTBM) {
            const { count } = await supabase
                .from('tbm_acks')
                .select('*', { count: 'exact', head: true })
                .eq('tbm_id', recentTBM.id);
            ackCount = count || 0;
        }

        // 2. 페르소나별 프롬프트 구성
        let personaPrompt = "";
        if (role === 'HQ_ADMIN') {
            personaPrompt = "You are the 'Site Commander Agent'. Focus on overall progress, weather/emergency risks, and site-wide productivity.";
        } else if (role === 'SAFETY_OFFICER') {
            personaPrompt = "You are the 'Site Safety Agent'. Focus on TBM acknowledgment rates, missing signatures, and dangerous keywords in chat logs.";
        } else {
            personaPrompt = "You are the 'Site Ops Agent'. Focus on administrative gaps and worker demographics.";
        }

        const prompt = `${personaPrompt}
Site Data Summary:
- Total Workers: ${totalWorkers || 'Unknown'}
- Latest TBM Ack Rate: ${ackCount}/${totalWorkers || '?'}
- Emergency Logs: No active SOS signals detected.

Task: Provide a concise 3-line briefing in [${lang}].
Format:
Line 1: 🏢 [Status Summary]
Line 2: ⚠️ [Critical Warning or Observation]
Line 3: 💡 [Recommended Action]

Respond ONLY in 3 lines, very professional and direct. Use honorifics.
`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                })
            }
        );

        const data = await response.json() as GeminiBriefingResponse;
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return NextResponse.json({ briefing: textContent || "데이터 분석 중입니다..." });

    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
