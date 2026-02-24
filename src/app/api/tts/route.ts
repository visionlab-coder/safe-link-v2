import { NextRequest } from 'next/server';

/**
 * [V3.0] Official Google Cloud Text-to-Speech Engine
 * Uses high-fidelity Neural2 & WaveNet voices.
 */
export async function GET(request: NextRequest) {
    const text = request.nextUrl.searchParams.get('text') ?? '';
    const lang = request.nextUrl.searchParams.get('lang') ?? 'ko';
    const gender = request.nextUrl.searchParams.get('gender') ?? 'female';
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;

    if (!text) return new Response('Missing text', { status: 400 });

    // API Key가 없으면 레거시(무료) 모드로 동작
    if (!apiKey) {
        return fetchLegacyTTS(text, lang);
    }
    try {
        // 1. 최상위 품질(Neural2 > Studio > WaveNet) 보이스 매핑
        const voiceName = getBestCloudVoice(lang, gender);
        console.log(`[TTS-Cloud] Synthesizing: "${text.substring(0, 20)}..." | Lang: ${lang} | Voice: ${voiceName}`);

        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: lang, name: voiceName, ssmlGender: gender.toUpperCase() },
                audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: 0 }
            })
        });

        if (!response.ok) {
            console.error("[TTS-Cloud] API Error:", await response.text());
            return fetchLegacyTTS(text, lang);
        }

        const data = await response.json();

        // 🚀 [FIX] Edge Runtime에서 Buffer 제거 (Base64 -> Uint8Array)
        const binaryString = atob(data.audioContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return new Response(bytes, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (e: any) {
        console.error("[TTS-Cloud] Error mapping:", e.message);
        return fetchLegacyTTS(text, lang);
    }
}

/** [Legacy] Unofficial Google Translate TTS as Fallback */
async function fetchLegacyTTS(text: string, lang: string) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&ttsspeed=1.0`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buffer = await resp.arrayBuffer();
    return new Response(buffer, { headers: { 'Content-Type': 'audio/mpeg' } });
}

/** 국가별 최정예 뉴럴 성우 매핑 데이터 (16개국 이상 대응) */
function getBestCloudVoice(lang: string, gender: string): string {
    const isMale = gender === 'male';
    const base = lang.split('-')[0].toLowerCase();

    const map: Record<string, { male: string, female: string }> = {
        'ko': { female: 'ko-KR-Neural2-A', male: 'ko-KR-Neural2-C' },
        'en': { female: 'en-US-Neural2-H', male: 'en-US-Neural2-D' },
        'zh': { female: 'zh-CN-Neural2-A', male: 'zh-CN-Neural2-B' },
        'vi': { female: 'vi-VN-Neural2-A', male: 'vi-VN-Wavenet-B' },
        'ja': { female: 'ja-JP-Neural2-B', male: 'ja-JP-Neural2-C' },
        'th': { female: 'th-TH-Neural2-A', male: 'th-TH-Standard-A' },
        'id': { female: 'id-ID-Wavenet-A', male: 'id-ID-Wavenet-B' },
        'ph': { female: 'fil-PH-Wavenet-A', male: 'fil-PH-Wavenet-B' }, // Filipino
        'tl': { female: 'fil-PH-Wavenet-A', male: 'fil-PH-Wavenet-B' },
        'ru': { female: 'ru-RU-Standard-C', male: 'ru-RU-Standard-D' },
        'uz': { female: 'uz-UZ-Standard-A', male: 'uz-UZ-Standard-A' }, // Standard Only
        'ne': { female: 'ne-NP-Standard-A', male: 'ne-NP-Standard-A' }, // Nepali
        'km': { female: 'km-KH-Standard-A', male: 'km-KH-Standard-A' }, // Khmer
        'my': { female: 'my-MM-Standard-A', male: 'my-MM-Standard-A' }, // Burmese
    };

    const target = map[base] || map['ko'];
    return isMale ? target.male : target.female;
}
