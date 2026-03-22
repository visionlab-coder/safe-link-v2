import { NextRequest } from 'next/server';
import { getErrorMessage } from '@/utils/errors';

interface GoogleTtsResponse {
    audioContent?: string;
}

/**
 * [V3.0] Official Google Cloud Text-to-Speech Engine
 * Uses high-fidelity Neural2 & WaveNet voices.
 */
export async function GET(request: NextRequest) {
    const text = request.nextUrl.searchParams.get('text') ?? '';
    const lang = request.nextUrl.searchParams.get('lang') ?? 'ko';
    const gender = request.nextUrl.searchParams.get('gender') ?? 'female';
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();

    if (!text) return new Response('Missing text', { status: 400 });
    if (text.length > 1000) return new Response('Text too long (max 1000 characters)', { status: 400 });

    if (!apiKey) {
        return fetchLegacyTTS(text, lang);
    }

    try {
        const voiceName = getBestCloudVoice(lang, gender);
        const voiceLangCode = getVoiceLangCode(lang);

        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: voiceLangCode, name: voiceName, ssmlGender: gender.toUpperCase() },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.0,
                    pitch: 0
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn('[TTS-Cloud] Falling back to legacy TTS:', errText.substring(0, 100));
            return fetchLegacyTTS(text, lang);
        }

        const data = await response.json() as GoogleTtsResponse;
        if (!data.audioContent) {
            throw new Error('Missing audioContent');
        }

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
    } catch (error: unknown) {
        console.warn('[TTS-Cloud] Error, falling back:', getErrorMessage(error));
        return fetchLegacyTTS(text, lang);
    }
}

/** [Legacy] Unofficial Google Translate TTS as Fallback */
async function fetchLegacyTTS(text: string, lang: string) {
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&ttsspeed=1.0`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buffer = await resp.arrayBuffer();
        return new Response(buffer, { headers: { 'Content-Type': 'audio/mpeg' } });
    } catch (error: unknown) {
        console.error('[TTS] Legacy fallback failed:', getErrorMessage(error));
        return new Response('TTS unavailable', { status: 503 });
    }
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
