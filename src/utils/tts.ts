/**
 * SAFE-LINK Premium TTS Utility - "Voice Actor" Quality
 * Priority: 1. Browser "Natural/Online" Neural Voices (Real Voice Actor quality)
 *           2. Internal API Proxy fallback (/api/tts) - Bypasses CORS browser blocks
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type VoiceGender = 'male' | 'female';

export const getVoiceLang = (c: string) => {
    const map: Record<string, string> = {
        ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN",
        th: "th-TH", uz: "uz-UZ", id: "id-ID", jp: "ja-JP",
        ph: "tl-PH"
    };
    return map[c] || c;
};

/**
 * 음성 재생 시 괄호 안의 내용은 무조건 제거 (근로자 피로감 방지)
 */
const stripForSpeech = (text: string): string => {
    let result = '';
    let depth = 0;
    for (const char of text) {
        if (char === '(' || char === '（') depth++;
        else if (char === ')' || char === '）') {
            if (depth > 0) depth--;
        } else if (depth === 0) {
            result += char;
        }
    }
    // Remove emojis so TTS doesn't read them out loud
    result = result.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    return result.replace(/\s{2,}/g, ' ').trim();
};

/** 텍스트 청크 분할 및 리듬 처리 (마침표 뒤에 미세한 휴지기 부여) */
const chunkText = (text: string): string[] => {
    // 인간적인 호흡을 위해 문장 부호 뒤에 공백 추가 처리
    const rhythmicText = text.replace(/([.!?。！？])/g, "$1  ");
    const segments = rhythmicText.match(/[^.!?。！？\n]+[.!?。！？\n]?/g) || [rhythmicText];
    const chunks: string[] = [];
    let cur = '';
    for (const seg of segments) {
        if ((cur + seg).length > 150) {
            if (cur.trim()) chunks.push(cur.trim());
            cur = seg;
        } else {
            cur += seg;
        }
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
};

/**
 * 성우급 오디오 재생 (Microsoft/Google Online Natural voices 선호)
 */
/**
 * 💎 Elite TTS Engine - Browser-native first (zero latency), cloud API as fallback.
 */
export const playPremiumAudio = (
    text: string,
    langCode: string,
    gender: VoiceGender = 'female',
    onEnd?: () => void
) => {
    if (!text || typeof window === 'undefined') {
        if (onEnd) onEnd();
        return;
    }

    const cleanText = stripForSpeech(text);
    if (!cleanText) {
        if (onEnd) onEnd();
        return;
    }

    const targetLang = getVoiceLang(langCode);
    const targetLangBase = targetLang.split('-')[0].toLowerCase();
    const voices = window.speechSynthesis?.getVoices() ?? [];
    const hasBrowserVoice = voices.some(v => v.lang.toLowerCase().startsWith(targetLangBase));

    if (hasBrowserVoice) {
        // 1. [Primary] Browser native - zero latency
        playBrowserNativeAudio(cleanText, langCode, gender, onEnd);
    } else {
        // 2. [Fallback] Cloud API proxy for languages without browser voice support
        playProxyAudio(cleanText, langCode, gender, (success) => {
            if (success) {
                if (onEnd) onEnd();
            } else {
                playBrowserNativeAudio(cleanText, langCode, gender, onEnd);
            }
        });
    }
};

/** 브라우저 내장 음성 (최후의 보루) */
const playBrowserNativeAudio = (text: string, langCode: string, gender: VoiceGender, onEnd?: () => void) => {
    const targetLang = getVoiceLang(langCode);
    if (typeof window === 'undefined' || !window.speechSynthesis) {
        console.warn("[PremiumTTS] speechSynthesis is not supported in this browser.");
        if (onEnd) onEnd();
        return;
    }

    // 🔊 세션 내 에러 발생 음성 블랙리스트 관리
    if (!(window as any)._tts_blacklist) (window as any)._tts_blacklist = new Set<string>();
    const voiceBlacklist = (window as any)._tts_blacklist as Set<string>;

    const voices = window.speechSynthesis.getVoices();
    const premiumKeywords = ['natural', 'online', 'neural', 'multilingual', 'premium', 'high'];
    const maleNames = ['guy', 'yunxi', 'yunyang', '대호', '민호', 'shinjie', 'ryan', 'stefan', 'paul', 'injoon', 'keita', 'ichiro', 'he-il', 'male', 'david', 'james', 'kakeru', 'namminh'];
    const femaleNames = ['aria', 'xiaoxiao', 'sun-hi', '혜미', '선희', '유리', '지현', '지민', 'sara', 'zira', 'anna', 'nanami', 'keiko', 'female', 'katherine', 'mayu', 'hoaimy', 'premwadee', 'thuy', 'linh'];

    const targetLangBase = targetLang.split('-')[0].toLowerCase();
    const candidateVoices = voices.filter(v =>
        v.lang.toLowerCase().startsWith(targetLangBase) &&
        !voiceBlacklist.has(v.name)
    );

    const scored = candidateVoices.map(v => {
        let score = 0;
        const lowName = v.name.toLowerCase();
        const isCorrect = gender === 'male' ? maleNames.some(n => lowName.includes(n)) : femaleNames.some(n => lowName.includes(n));
        const isWrong = gender === 'male' ? (femaleNames.some(n => lowName.includes(n)) || lowName.includes('female')) : (maleNames.some(n => lowName.includes(n)) || lowName.includes('male'));
        if (isWrong) score -= 1000000;
        if (isCorrect) score += 20000;
        if (premiumKeywords.some(k => lowName.includes(k))) score += 50000;
        if (lowName.includes('microsoft')) score += 5000;
        return { voice: v, score };
    }).sort((a, b) => b.score - a.score);

    const bestVoice = scored.length > 0 ? scored[0].voice : null;

    if (!bestVoice) {
        console.warn("[PremiumTTS] No usable browser voices. Silence fallthrough.");
        if (onEnd) onEnd();
        return;
    }

    window.speechSynthesis.cancel();
    const chunks = chunkText(text);
    let current = 0;

    const speakNext = () => {
        if (current >= chunks.length) { if (onEnd) onEnd(); return; }
        const currentChunk = chunks[current++];
        const utter = new SpeechSynthesisUtterance(currentChunk);
        utter.voice = bestVoice;
        utter.lang = targetLang;

        // 🚀 중국어 발화 속도 최적화 (너무 느리다는 피드백 반영)
        utter.rate = targetLang.startsWith('zh') ? 1.15 : 0.95;

        utter.onend = speakNext;
        utter.onerror = (err) => {
            console.warn(`[PremiumTTS] Browser Native Runtime Fallback: ${bestVoice.name}`, err);
            // ❌ 에러 발생 시 해당 음성 블랙리스트 추가
            voiceBlacklist.add(bestVoice.name);
            window.speechSynthesis.cancel();
            // 즉시 Proxy로 재시도
            playProxyAudio(currentChunk, langCode, gender, () => speakNext());
        };
        window.speechSynthesis.speak(utter);
    };
    speakNext();
};

/**
 * [수정] 서버 기반 TTS (API 파라미터에 gender 추가)
 * @returns success 여부를 콜백으로 전달
 */
export const playProxyAudio = (text: string, lang: string, gender: VoiceGender, onDone?: (success: boolean) => void) => {
    const tl = lang === 'zh' ? 'zh-CN' : lang;
    const segments = text.match(/[^.!?。！？\n]+[.!?。！？\n]?/g) || [text];
    let streamIdx = 0;

    const nextStream = () => {
        if (streamIdx >= segments.length) {
            if (onDone) onDone(true);
            return;
        }
        const chunk = segments[streamIdx++].trim();
        if (!chunk) { nextStream(); return; }

        const url = `/api/tts?text=${encodeURIComponent(chunk)}&lang=${tl}&gender=${gender}`;
        const audio = new Audio(url);

        audio.onplay = () => {};
        audio.onended = nextStream;
        audio.onerror = (e) => {
            console.warn("[PremiumTTS] Proxy Audio Error:", e);
            if (onDone) onDone(false);
        };

        audio.play().catch(err => {
            console.warn("[PremiumTTS] Audio Play Denied:", err);
            if (onDone) onDone(false);
        });
    };
    nextStream();
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    setTimeout(loadVoices, 500);
}
