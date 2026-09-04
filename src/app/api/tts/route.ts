import { NextRequest } from 'next/server';
export const runtime = "nodejs";
import { getCookieUser } from "@/utils/auth/cookie-user";
import { checkTtsLimit } from "@/utils/rate-limit";
import { callV3AiTts } from "@/utils/ai/v3-ai-gateway";
import { stripForSpeech } from "@/utils/tts";

// Google 음성이 없는 언어는 OpenAI TTS를 사용한다. Google Cloud에는
// `km-KH-Standard-A`가 없으므로 캄보디아어(km)는 OpenAI 음성으로 고정한다.
const OPENAI_TTS_LANGS = new Set(['uz', 'ne', 'km', 'my', 'mn', 'kk']);

/**
 * [V3.1] Google Cloud TTS (Neural2/WaveNet) + OpenAI tts-1-hd 하이브리드
 * Standard-only 언어(uz/ne/km/my/mn/kk)는 OpenAI tts-1-hd 우선 사용
 */
export async function GET(request: NextRequest) {
    // P5 박제: createServerClient.getUser() → getCookieUser() (raw JWT 파싱)
    const user = await getCookieUser({ allowV3: true });
    if (!user) return new Response("UNAUTHORIZED", { status: 401 });
    if (!(await checkTtsLimit(user.id))) {
        return new Response("RATE_LIMITED", { status: 429 });
    }

    const text = stripForSpeech(request.nextUrl.searchParams.get('text') ?? '');
    const lang = request.nextUrl.searchParams.get('lang') ?? 'ko';
    const gender = request.nextUrl.searchParams.get('gender') ?? 'female';
    if (!text) return new Response('Missing text', { status: 400 });
    if (text.length > 1000) return new Response('Text too long (max 1000 characters)', { status: 400 });
    const siteId = user.siteIds?.[0];
    if (user.source !== "v3" || typeof siteId !== "number") {
        return new Response("V3_SITE_SESSION_REQUIRED", { status: 403 });
    }
    const baseLang = lang.split('-')[0].toLowerCase();
    const upstream = await callV3AiTts(request, {
        siteId,
        text,
        voiceLanguageCode: getVoiceLangCode(lang),
        voiceName: getBestCloudVoice(lang, gender),
        gender,
        preferOpenAi: OPENAI_TTS_LANGS.has(baseLang),
        // 중국어는 Google 보통화를 메인으로 사용한다. Google 요청 실패 시에는
        // 무음으로 끝내지 않고 OpenAI 보조 TTS로 한 번만 대체한다.
        // 그 외 언어는 선택된 주 제공자만 사용해 음색이 임의로 바뀌지 않게 한다.
        strictProvider: baseLang !== 'zh',
    });
    if (!upstream) return new Response("TTS gateway unavailable", { status: 503 });
    if (!upstream.ok) {
        return new Response(await upstream.text().catch(() => ""), {
            status: upstream.status,
            headers: { "Content-Type": upstream.headers.get("content-type") || "text/plain" },
        });
    }
    const data = await upstream.json() as { audioBase64?: string; contentType?: string };
    if (!data.audioBase64) return new Response("TTS unavailable", { status: 503 });
    return new Response(Buffer.from(data.audioBase64, "base64"), {
        headers: {
            "Content-Type": data.contentType || "audio/mpeg",
            "Cache-Control": "public, max-age=3600",
        },
    });
}

/** 앱 내부 코드 → Google TTS languageCode 변환 */
function getVoiceLangCode(lang: string): string {
    const map: Record<string, string> = {
        'ko': 'ko-KR', 'en': 'en-US', 'zh': 'zh-CN', 'vi': 'vi-VN', 'ja': 'ja-JP', 'jp': 'ja-JP',
        'th': 'th-TH', 'id': 'id-ID', 'ph': 'fil-PH', 'tl': 'fil-PH', 'ru': 'ru-RU',
        'uz': 'uz-UZ', 'ne': 'ne-NP', 'km': 'km-KH', 'my': 'my-MM',
        'hi': 'hi-IN', 'bn': 'bn-IN', 'ar': 'ar-XA', 'fr': 'fr-FR', 'es': 'es-ES',
        'mn': 'mn-MN', 'kk': 'kk-KZ',
    };
    return map[lang] || lang;
}

/** 국가별 최고 품질 뉴럴 성우 매핑 (20개 언어 전체) */
function getBestCloudVoice(lang: string, gender: string): string {
    const isMale = gender === 'male';
    const base = lang.split('-')[0].toLowerCase();

    const map: Record<string, { male: string, female: string, langCode: string }> = {
        'ko': { female: 'ko-KR-Neural2-A', male: 'ko-KR-Neural2-C', langCode: 'ko-KR' },
        'en': { female: 'en-US-Neural2-H', male: 'en-US-Neural2-D', langCode: 'en-US' },
        'zh': { female: 'zh-CN-Neural2-A', male: 'zh-CN-Neural2-B', langCode: 'zh-CN' },
        'vi': { female: 'vi-VN-Neural2-A', male: 'vi-VN-Wavenet-B', langCode: 'vi-VN' },
        'ja': { female: 'ja-JP-Neural2-B', male: 'ja-JP-Neural2-C', langCode: 'ja-JP' },
        'jp': { female: 'ja-JP-Neural2-B', male: 'ja-JP-Neural2-C', langCode: 'ja-JP' },
        'th': { female: 'th-TH-Neural2-C', male: 'th-TH-Standard-A', langCode: 'th-TH' },
        'id': { female: 'id-ID-Wavenet-A', male: 'id-ID-Wavenet-B', langCode: 'id-ID' },
        'ph': { female: 'fil-PH-Wavenet-A', male: 'fil-PH-Wavenet-B', langCode: 'fil-PH' },
        'tl': { female: 'fil-PH-Wavenet-A', male: 'fil-PH-Wavenet-B', langCode: 'fil-PH' },
        'ru': { female: 'ru-RU-Wavenet-A', male: 'ru-RU-Wavenet-B', langCode: 'ru-RU' },
        'uz': { female: 'uz-UZ-Standard-A', male: 'uz-UZ-Standard-A', langCode: 'uz-UZ' },
        'ne': { female: 'ne-NP-Standard-A', male: 'ne-NP-Standard-A', langCode: 'ne-NP' },
        'km': { female: 'km-KH-Standard-A', male: 'km-KH-Standard-A', langCode: 'km-KH' },
        'my': { female: 'my-MM-Standard-A', male: 'my-MM-Standard-A', langCode: 'my-MM' },
        'hi': { female: 'hi-IN-Neural2-A', male: 'hi-IN-Neural2-B', langCode: 'hi-IN' },
        'bn': { female: 'bn-IN-Wavenet-A', male: 'bn-IN-Wavenet-B', langCode: 'bn-IN' },
        'ar': { female: 'ar-XA-Wavenet-A', male: 'ar-XA-Wavenet-B', langCode: 'ar-XA' },
        'fr': { female: 'fr-FR-Neural2-A', male: 'fr-FR-Neural2-B', langCode: 'fr-FR' },
        'es': { female: 'es-ES-Neural2-A', male: 'es-ES-Neural2-B', langCode: 'es-ES' },
        'mn': { female: 'mn-MN-Standard-A', male: 'mn-MN-Standard-A', langCode: 'mn-MN' },
        'kk': { female: 'kk-KZ-Standard-A', male: 'kk-KZ-Standard-A', langCode: 'kk-KZ' },
    };

    const target = map[base] || map['ko'];
    return isMale ? target.male : target.female;
}
