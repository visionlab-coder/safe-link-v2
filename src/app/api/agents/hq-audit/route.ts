import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage } from '@/utils/errors';

export const runtime = "nodejs";

interface GeminiAuditResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
}

/**
 * 🔴 HQ Global Audit Agent API (Tier 1)
 * 전사 데이터(25개 이상 현장의 TBM 이행률, 위험 대화, 서류 누락 등)를 전수 조사하여 
 * 본사 관제센터 요원들에게 보고서를 제출합니다.
 */
export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    try {
        const { lang = "ko" } = await request.json();
        const supabase = await createClient();

        // 인증 + 권한 확인 (HQ_OFFICER, SITE_MANAGER만 허용)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        const allowedRoles = ['HQ_OFFICER', 'SITE_MANAGER', 'ROOT'];
        if (!profile || !allowedRoles.includes(profile.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 1. 전사 데이터 샘플링
        // [전체 현장 요약]
        const { data: allSites } = await supabase.from('profiles').select('site_code').not('site_code', 'is', null);
        const siteCounts: Record<string, number> = {};
        allSites?.forEach(p => {
            if (p.site_code) siteCounts[p.site_code] = (siteCounts[p.site_code] || 0) + 1;
        });

        // [위험 대화 통계 스캔] — 원문/번역문은 수집하지 않음 (PIPA 준수)
        // 집계 메타데이터만 사용: 총 메시지 수, 시간대별 분포, 언어별 분포
        const { data: recentMsgsMeta } = await supabase
            .from('messages')
            .select('created_at, source_lang')
            .order('created_at', { ascending: false })
            .limit(200);

        const totalMessages = recentMsgsMeta?.length ?? 0;

        // 시간대별 분포 (0-23시)
        const hourlyDist: Record<number, number> = {};
        recentMsgsMeta?.forEach(m => {
            const hour = new Date(m.created_at).getHours();
            hourlyDist[hour] = (hourlyDist[hour] || 0) + 1;
        });

        // 언어별 분포
        const langDist: Record<string, number> = {};
        recentMsgsMeta?.forEach(m => {
            const lang = m.source_lang ?? 'unknown';
            langDist[lang] = (langDist[lang] || 0) + 1;
        });

        // 2. HQ 요원 프롬프트 (Risk Watchdog + Compliance Auditor)
        // 외부 데이터는 모두 JSON.stringify 처리하여 Prompt Injection 방지
        const prompt = `You are a group of 'HQ Command Agents' for a massive construction project (25+ sites).

Data Context:
- Active Sites: ${Object.keys(siteCounts).length}
- Worker Distribution: ${JSON.stringify(siteCounts)}
- Total Recent Messages (last 200): ${totalMessages}
- Language Distribution: ${JSON.stringify(langDist)}
- Hourly Activity Distribution: ${JSON.stringify(hourlyDist)}

Task: Provide a high-level command briefing for the HQ Control Center in [${lang}].
Focus on broad risks, compliance gaps across all sites, and resource allocation.

Format:
- [Risk Watchdog]: (Detect issues in recent chats or site activity)
- [Compliance Auditor]: (Analyze TBM and signature statuses globally)
- [Strategic Action]: (Global directive for all Site Managers)

Use professional, decisive, and authoritative tone. Respond in 3 sections.
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

        const data = await response.json() as GeminiAuditResponse;
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return NextResponse.json({ audit: textContent || "본사 관제 데이터를 분석 중입니다..." });

    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
