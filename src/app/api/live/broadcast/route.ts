import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/live/broadcast
 * 관리자가 실시간 통역 발화 시 호출.
 * 서버가 활성 언어(근로자 등록된 언어)로 프리번역 후 DB 저장.
 *
 * 효과
 * - 근로자 N명 × 번역 N회 → 서버 1회로 압축 (97% 절감)
 * - 근로자 측 API 호출 제거 → 지연 3초 → 1초
 * - 신규 국적 근로자 등록 시 다음 발화부터 자동 포함
 */

interface BroadcastBody {
    session_id: string;
    text_ko: string;
    site_id?: string | null;
}

interface PapagoResponse {
    message?: { result?: { translatedText?: string } };
}

// 앱 내부 언어 코드 → Papago/Google 코드
const LANG_MAP: Record<string, string> = {
    ko: 'ko', vi: 'vi', zh: 'zh-CN', th: 'th', uz: 'uz',
    ph: 'tl', km: 'km', id: 'id', mn: 'mn', my: 'my',
    ne: 'ne', bn: 'bn', kk: 'kk', ru: 'ru', en: 'en',
    jp: 'ja', fr: 'fr', es: 'es', ar: 'ar', hi: 'hi',
};

const PAPAGO_LANGS = new Set(['ko', 'en', 'zh-CN', 'vi', 'id', 'th', 'ru', 'ja', 'fr', 'es']);

async function translateOne(
    text: string,
    targetLang: string,
    googleKey: string,
    naverId: string | undefined,
    naverSecret: string | undefined,
): Promise<string> {
    const apiLang = LANG_MAP[targetLang] || targetLang;

    // 1. Papago 지원 언어 → Papago 우선
    if (naverId && naverSecret && PAPAGO_LANGS.has(apiLang)) {
        try {
            const res = await fetch('https://papago.apigw.ntruss.com/nmt/v1/translation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-NCP-APIGW-API-KEY-ID': naverId,
                    'X-NCP-APIGW-API-KEY': naverSecret,
                },
                body: new URLSearchParams({ source: 'ko', target: apiLang, text }),
            });
            if (res.ok) {
                const data = await res.json() as PapagoResponse;
                const translated = data.message?.result?.translatedText;
                if (translated) return translated;
            }
        } catch {
            // Google 폴백
        }
    }

    // 2. Google Cloud Translation 폴백
    try {
        const res = await fetch(
            `https://translation.googleapis.com/language/translate/v2?key=${googleKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: text, source: 'ko', target: apiLang, format: 'text' }),
            }
        );
        if (!res.ok) return text;
        const data = await res.json() as { data?: { translations?: Array<{ translatedText?: string }> } };
        return data.data?.translations?.[0]?.translatedText || text;
    } catch {
        return text;
    }
}

/** 시스템에 등록된 활성 근로자 언어 목록 (Korean 제외) */
async function getActiveLangs(supabase: Awaited<ReturnType<typeof createClient>>, siteId: string | null | undefined): Promise<string[]> {
    let query = supabase.from('profiles')
        .select('preferred_lang')
        .eq('status', 'ACTIVE');

    // site_id 지정 시 해당 현장만, 없으면 전체
    if (siteId) query = query.eq('site_id', siteId);

    const { data } = await query;
    if (!data) return [];

    const set = new Set<string>();
    for (const row of data) {
        const lang = row.preferred_lang;
        if (lang && lang !== 'ko') set.add(lang);
    }
    return Array.from(set);
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인 — 관리자 계층만 broadcast 가능
    const { data: profile } = await supabase.from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    if (!profile || !['ROOT', 'HQ_ADMIN', 'SAFETY_OFFICER'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: BroadcastBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { session_id, text_ko, site_id } = body;
    if (!session_id || !text_ko?.trim()) {
        return NextResponse.json({ error: 'session_id and text_ko required' }, { status: 400 });
    }
    if (text_ko.length > 2000) {
        return NextResponse.json({ error: 'text_ko too long (max 2000)' }, { status: 400 });
    }

    const googleKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    if (!googleKey) {
        return NextResponse.json({ error: 'Translation service unavailable' }, { status: 503 });
    }
    const naverId = process.env.NAVER_CLIENT_ID?.trim();
    const naverSecret = process.env.NAVER_CLIENT_SECRET?.trim();

    // 활성 언어 조회
    const activeLangs = await getActiveLangs(supabase, site_id);

    // 병렬 번역
    const translations: Record<string, string> = {};
    const text = text_ko.trim();
    await Promise.all(
        activeLangs.map(async (lang) => {
            const result = await translateOne(text, lang, googleKey, naverId, naverSecret);
            translations[lang] = result;
        })
    );

    // DB 저장
    const payload: Record<string, unknown> = {
        session_id,
        text_ko: text,
        created_by: user.id,
        translations,
        active_langs: activeLangs,
    };
    if (site_id) payload.site_id = site_id;

    const { data: inserted, error } = await supabase
        .from('live_translations')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('[Live Broadcast] Insert failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        id: inserted.id,
        translated_to: activeLangs,
        count: activeLangs.length,
    });
}
