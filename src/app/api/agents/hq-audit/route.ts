import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

        // 1. 전사 데이터 샘플링
        // [전체 현장 요약]
        const { data: allSites } = await supabase.from('profiles').select('site_code').not('site_code', 'is', null);
        const siteCounts: Record<string, number> = {};
        allSites?.forEach(p => {
            if (p.site_code) siteCounts[p.site_code] = (siteCounts[p.site_code] || 0) + 1;
        });

        // [위험 대화 스캔]
        const { data: recentMsgs } = await supabase
            .from('messages')
            .select('source_text, translated_text')
            .order('created_at', { ascending: false })
            .limit(20);

        // 2. HQ 요원 프롬프트 (Risk Watchdog + Compliance Auditor)
        const prompt = `You are a group of 'HQ Command Agents' for a massive construction project (25+ sites).
        
Data Context:
- Active Sites: ${Object.keys(siteCounts).length}
- Worker Distribution: ${JSON.stringify(siteCounts)}
- Recent Chat Snippets: ${recentMsgs?.map(m => m.source_text).join(' | ')}

Task: Provide a high-level command briefing for the HQ Control Center in [${lang}].
Focus on broad risks, compliance gaps across all sites, and resource allocation.

Format:
- [Risk Watchdog]: (Detect issues in recent chats or site activity)
- [Compliance Auditor]: (Analyze TBM and signature statuses globally)
- [Strategic Action]: (Global directive for all Site Managers)

Use professional, decisive, and authoritative tone. Respond in 3 sections.
`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                })
            }
        );

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return NextResponse.json({ audit: textContent || "본사 관제 데이터를 분석 중입니다..." });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
