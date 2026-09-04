/**
 * SQ Link Premium TTS Utility - "Voice Actor" Quality
 * Priority: 1. Browser "Natural/Online" Neural Voices (Real Voice Actor quality)
 *           2. Internal API Proxy fallback (/api/tts) - Bypasses CORS browser blocks
 */
export type VoiceGender = 'male' | 'female';

const notifyTtsFailure = () => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sq-link:tts-failure"));
    }
};

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
export const stripForSpeech = (text: string): string => {
    // 닫힌 괄호는 화면 보충 설명이므로 통째로 읽지 않는다.
    // 닫히지 않은 괄호는 사용자가 입력을 이어가는 중일 수 있어 기호만 제거하고 본문은 보존한다.
    // 예: "안전모(필수 착용)를 쓰세요" → "안전모를 쓰세요"
    const result = text
        .replace(/\([^)]*\)|（[^）]*）/g, ' ')
        .replace(/[()（）\[\]［］{}｛｝<>〈〉《》]/g, ' ')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ' ')
        .replace(/[^\p{L}\p{M}\p{N}\s.,!?。！？។]/gu, ' ');
    return result.replace(/\s{2,}/g, ' ').trim();
};

/** 텍스트 청크 분할 및 리듬 처리 (마침표 뒤에 미세한 휴지기 부여) */
const chunkText = (text: string): string[] => {
    // 인간적인 호흡을 위해 문장 부호 뒤에 공백 추가 처리
    const rhythmicText = text.replace(/([.!?。！？។])/g, "$1  ");
    const segments = rhythmicText.match(/[^.!?。！？។\n]+[.!?。！？។\n]?/g) || [rhythmicText];
    const chunks: string[] = [];
    let cur = '';
    for (const seg of segments) {
        // 띄어쓰기나 문장 부호가 없는 언어/음성 인식 결과도 서버 TTS 1,000자 제한을
        // 넘지 않도록 안전한 길이로 나눈다. 캄보디아어의 `។`도 위에서 문장 끝으로 처리한다.
        if (seg.length > 150) {
            if (cur.trim()) chunks.push(cur.trim());
            cur = '';
            for (let offset = 0; offset < seg.length; offset += 150) {
                chunks.push(seg.slice(offset, offset + 150).trim());
            }
            continue;
        }
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
    onEnd?: () => void,
    onStart?: () => void,
) => {
    if (!text || typeof window === 'undefined') {
        if (typeof window !== 'undefined') notifyTtsFailure();
        if (onEnd) onEnd();
        return;
    }

    const cleanText = stripForSpeech(text);
    if (!cleanText) {
        notifyTtsFailure();
        if (onEnd) onEnd();
        return;
    }

    // 모든 플랫폼에서 서버 음성만 사용한다. 기기 TTS 폴백은 OS·설치 음성에 따라
    // 같은 문장도 다른 목소리로 들리는 문제를 만들기 때문이다.
    playProxyAudio(cleanText, langCode, gender, (success) => {
        if (success) {
            if (onEnd) onEnd();
        } else {
            notifyTtsFailure();
            onEnd?.();
        }
    }, onStart);
};

/**
 * 현장 실시간 통역 방송용 재생.
 *
 * Android 앱 WebView는 네이티브 설정으로 사용자 제스처 없이 HTML 오디오 재생을
 * 허용한다. 따라서 방송 수신은 기기 내장 TTS보다 서버 TTS 오디오를 먼저 사용해
 * 근로자가 별도 스피커 버튼을 누르지 않아도 수신 즉시 재생되도록 한다.
 */
export const playLiveBroadcastAudio = (
    text: string,
    langCode: string,
    gender: VoiceGender = 'female',
    onEnd?: () => void,
    onStart?: () => void,
) => {
    if (!text || typeof window === 'undefined') {
        if (typeof window !== 'undefined') notifyTtsFailure();
        onEnd?.();
        return;
    }

    const cleanText = stripForSpeech(text);
    if (!cleanText) {
        notifyTtsFailure();
        onEnd?.();
        return;
    }

    // 방송도 동일한 서버 음성을 사용한다. 기기별 음성 엔진으로 바꾸지 않는다.
    playProxyAudio(cleanText, langCode, gender, (success) => {
        if (success) {
            onEnd?.();
            return;
        }
        notifyTtsFailure();
        onEnd?.();
    }, onStart);
};

/**
 * 서버 기반 TTS (Google Cloud Neural2)
 * 모든 청크를 동시에 prefetch → 순차 재생 (다음 청크가 이미 버퍼링된 상태로 대기)
 * 오디오 재생 차단 시 브라우저 TTS로 폴백, 실패해도 큐 멈추지 않음
 */
export const playProxyAudio = (
    text: string,
    lang: string,
    gender: VoiceGender,
    onDone?: (success: boolean) => void,
    onStart?: () => void,
) => {
    const tl = lang === 'zh' ? 'zh-CN' : lang;
    // chunkText는 언어별 문장 끝기호와 서버 요청 길이 제한을 함께 처리한다.
    const segments = chunkText(text);

    if (segments.length === 0) { onDone?.(false); return; }

    // 모든 청크 동시 prefetch — 1번 재생 중에 2·3번이 이미 버퍼링됨 (순차 다운로드 지연 제거)
    const audios = segments.map(chunk => {
        const url = `/api/tts?text=${encodeURIComponent(chunk)}&lang=${tl}&gender=${gender}`;
        const audio = new Audio(url);
        audio.preload = 'auto';
        return { audio, chunk, url };
    });

    let idx = 0;
    let anySuccess = false;
    let started = false;
    const announceStart = () => {
        if (started) return;
        started = true;
        onStart?.();
    };

    const playNext = () => {
        if (idx >= audios.length) { onDone?.(anySuccess); return; }
        const { audio, url } = audios[idx++];
        let fallbackStarted = false;
        let retried = false;
        let startWatchdog: number | undefined;
        const fallback = () => {
            if (fallbackStarted) return;
            fallbackStarted = true;
            if (startWatchdog !== undefined) window.clearTimeout(startWatchdog);
            // audio.play() 실패 직후에도 네트워크 오디오가 늦게 시작되는 WebView가 있다.
            // 실패한 원본 오디오는 즉시 중지한다.
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
            playNext();
        };
        const retryOrFallback = () => {
            if (fallbackStarted) return;
            // 운영 TTS 제공자가 일시적으로 503을 반환하는 경우가 있어, 같은 문장을
            // 한 번만 다시 요청한다. 두 번째도 실패하면 재생을 종료한다.
            if (!retried) {
                retried = true;
                if (startWatchdog !== undefined) window.clearTimeout(startWatchdog);
                audio.pause();
                audio.src = `${url}&retry=1`;
                audio.load();
                startWatchdog = window.setTimeout(fallback, 12_000);
                window.setTimeout(() => { audio.play().catch(retryOrFallback); }, 250);
                return;
            }
            fallback();
        };
        // 백엔드 TTS 자체 제한이 최대 10초다. 그보다 짧게 끊으면 정상 응답도
        // 캄보디아어 기기 폴백으로 넘어가 영어 재생 또는 실패로 보일 수 있다.
        startWatchdog = window.setTimeout(retryOrFallback, 12_000);
        audio.onplaying = () => {
            if (startWatchdog !== undefined) window.clearTimeout(startWatchdog);
            announceStart();
        };
        audio.onended = () => { if (startWatchdog !== undefined) window.clearTimeout(startWatchdog); anySuccess = true; playNext(); };
        audio.onerror = retryOrFallback;
        audio.play().catch(retryOrFallback);
    };
    playNext();
};
