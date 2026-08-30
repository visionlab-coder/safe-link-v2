"use client";

import { useEffect, useState } from "react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const MESSAGES: Record<string, string> = {
    ko: "음성을 재생할 수 없습니다. 기기의 미디어 음량과 TTS 설정을 확인해주세요.",
    en: "Unable to play audio. Check your device volume and text-to-speech settings.",
    zh: "无法播放语音。请检查设备音量和文字转语音设置。",
    vi: "Không thể phát âm thanh. Hãy kiểm tra âm lượng và cài đặt chuyển văn bản thành giọng nói.",
    ru: "Не удалось воспроизвести звук. Проверьте громкость и настройки синтеза речи.",
};

/** 모든 웹·앱 화면에서 공통으로 사용하는 TTS 실패 안내 토스트. */
export default function TtsFailureToast() {
    const language = useDisplayLanguage();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let dismissTimer: number | undefined;
        const show = () => {
            window.clearTimeout(dismissTimer);
            setVisible(true);
            dismissTimer = window.setTimeout(() => setVisible(false), 5000);
        };
        window.addEventListener("sq-link:tts-failure", show);
        return () => {
            window.removeEventListener("sq-link:tts-failure", show);
            window.clearTimeout(dismissTimer);
        };
    }, []);

    if (!visible) return null;
    const message = MESSAGES[language] ?? MESSAGES.en;
    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-4 top-[max(env(safe-area-inset-top,0px),1rem)] z-[100] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-[0_16px_40px_rgba(16,42,67,.18)]"
        >
            <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">!</span>
            <p className="leading-5">{message}</p>
            <button type="button" onClick={() => setVisible(false)} aria-label="Close" className="ml-auto -mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
        </div>
    );
}
