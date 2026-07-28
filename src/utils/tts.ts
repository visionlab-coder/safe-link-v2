/**
 * SQ Link Premium TTS Utility - "Voice Actor" Quality
 * Priority: 1. Browser "Natural/Online" Neural Voices (Real Voice Actor quality)
 *           2. Internal API Proxy fallback (/api/tts) - Bypasses CORS browser blocks
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type VoiceGender = 'male' | 'female';

export const getVoiceLang = (c: string) => {
    const map: Record<string, string> = {
        ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN",
        th: "th-TH", uz: "uz-UZ", id: "id-ID", ja: "ja-JP", jp: "ja-JP",
        ph: "tl-PH", km: "km-KH", mn: "mn-MN", my: "my-MM",
        ne: "ne-NP", bn: "bn-BD", kk: "kk-KZ", ru: "ru-RU",
        fr: "fr-FR", es: "es-ES", ar: "ar-SA", hi: "hi-IN",
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

    // iPhone/iPad Safari는 비동기 네트워크 요청 뒤의 audio.play()/speechSynthesis를
    // 사용자 제스처로 인정하지 않아 무음으로 끝날 수 있다. 클릭 이벤트 안에서
    // 브라우저 TTS를 즉시 시작해야 재생 권한이 유지된다.
    const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isAppleMobile) {
        playBrowserNativeAudio(cleanText, langCode, gender, onEnd);
        return;
    }

    // Cloud TTS 우선 (Google Neural2 고품질) → 브라우저 TTS 폴백
    // 이유: 브라우저 TTS는 자동재생 차단·음성 불안정 이슈가 빈번
    playProxyAudio(cleanText, langCode, gender, (success) => {
        if (success) {
            if (onEnd) onEnd();
        } else {
            // Cloud 실패 시 브라우저 내장 음성으로 폴백
            playBrowserNativeAudio(cleanText, langCode, gender, onEnd);
        }
    });
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

    // iOS는 첫 호출에서 getVoices()가 빈 배열이어도 기본 음성으로는 재생할 수 있다.
    const bestVoice = scored.length > 0 ? scored[0].voice : null;

    window.speechSynthesis.cancel();
    const chunks = chunkText(text);
    let current = 0;

    const speakNext = () => {
        if (current >= chunks.length) { if (onEnd) onEnd(); return; }
        const currentChunk = chunks[current++];
        const utter = new SpeechSynthesisUtterance(currentChunk);
        if (bestVoice) utter.voice = bestVoice;
        utter.lang = targetLang;

        // 🚀 중국어 발화 속도 최적화 (너무 느리다는 피드백 반영)
        utter.rate = targetLang.startsWith('zh') ? 1.15 : 0.95;

        // 일부 iOS Safari 버전은 긴 문장의 onend/onerror를 누락한다.
        // 영구 잠김을 막되 실제 재생 시간을 충분히 보장하는 안전 타임아웃이다.
        const maxChunkMs = Math.min(45_000, Math.max(10_000, currentChunk.length * 250 + 8_000));
        let settled = false;
        const finishChunk = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(watchdog);
            speakNext();
        };
        const watchdog = window.setTimeout(() => {
            console.warn("[PremiumTTS] Browser speech completion event timed out.");
            window.speechSynthesis.cancel();
            finishChunk();
        }, maxChunkMs);

        utter.onend = finishChunk;
        utter.onerror = (err) => {
            console.warn(`[PremiumTTS] Browser Native Runtime Fallback: ${bestVoice?.name ?? "default"}`, err);
            // ❌ 에러 발생 시 해당 음성 블랙리스트 추가
            if (bestVoice) voiceBlacklist.add(bestVoice.name);
            window.speechSynthesis.cancel();
            window.clearTimeout(watchdog);
            if (settled) return;
            settled = true;
            // Apple 모바일은 비동기 Proxy 재시도가 다시 자동재생 차단될 수 있으므로
            // 다음 청크로 안전하게 진행한다. 그 외 브라우저만 Proxy를 재시도한다.
            const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
                || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
            if (isAppleMobile) {
                speakNext();
            } else {
                playProxyAudio(currentChunk, langCode, gender, () => speakNext());
            }
        };
        window.speechSynthesis.speak(utter);
    };
    speakNext();
};

/**
 * 서버 기반 TTS (Google Cloud Neural2)
 * 모든 청크를 동시에 prefetch → 순차 재생 (다음 청크가 이미 버퍼링된 상태로 대기)
 * 오디오 재생 차단 시 브라우저 TTS로 폴백, 실패해도 큐 멈추지 않음
 */
export const playProxyAudio = (text: string, lang: string, gender: VoiceGender, onDone?: (success: boolean) => void) => {
    const tl = lang === 'zh' ? 'zh-CN' : lang;
    const rawSegments = text.match(/[^.!?。！？\n]+[.!?。！？\n]?/g) || [text];
    const segments = rawSegments.map(s => s.trim()).filter(Boolean);

    if (segments.length === 0) { onDone?.(false); return; }

    // 모든 청크 동시 prefetch — 1번 재생 중에 2·3번이 이미 버퍼링됨 (순차 다운로드 지연 제거)
    const audios = segments.map(chunk => {
        const url = `/api/tts?text=${encodeURIComponent(chunk)}&lang=${tl}&gender=${gender}`;
        const audio = new Audio(url);
        audio.preload = 'auto';
        return { audio, chunk };
    });

    let idx = 0;
    let anySuccess = false;

    const playNext = () => {
        if (idx >= audios.length) { onDone?.(anySuccess); return; }
        const { audio, chunk } = audios[idx++];
        audio.onended = () => { anySuccess = true; playNext(); };
        audio.onerror = () => tryBrowserFallback(chunk, lang, gender, playNext);
        audio.play().catch(() => tryBrowserFallback(chunk, lang, gender, playNext));
    };
    playNext();
};

/** 단일 청크에 대한 브라우저 TTS 폴백 (실패해도 콜백 호출하여 큐 진행) */
const tryBrowserFallback = (text: string, lang: string, gender: VoiceGender, onEnd: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
        onEnd();
        return;
    }
    const targetLang = getVoiceLang(lang);
    const targetLangBase = targetLang.split('-')[0].toLowerCase();
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase().startsWith(targetLangBase));

    if (!voice) {
        onEnd();
        return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = targetLang;
    utter.rate = 0.95;
    utter.onend = onEnd;
    utter.onerror = () => onEnd();
    window.speechSynthesis.speak(utter);
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    setTimeout(loadVoices, 500);
}
