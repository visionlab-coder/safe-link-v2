"use client";

import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { getT as getAuthT } from "@/app/auth/translations";

const PLAY_LABELS: Record<string, { idle: string; playing: string }> = {
    ko: { idle: "메시지를 음성으로 듣기", playing: "음성 재생 중" },
    en: { idle: "Listen to message", playing: "Playing audio" },
    zh: { idle: "朗读消息", playing: "正在播放语音" },
    vi: { idle: "Nghe tin nhắn", playing: "Đang phát âm thanh" },
    ru: { idle: "Прослушать сообщение", playing: "Воспроизведение аудио" },
};

type ChatPlayButtonProps = {
    onClick: () => void;
    disabled?: boolean;
    playing?: boolean;
    label?: string;
};

export default function ChatPlayButton({
    onClick,
    disabled = false,
    playing = false,
    label,
}: ChatPlayButtonProps) {
    const language = useDisplayLanguage();
    const text = PLAY_LABELS[language] ?? { idle: getAuthT(language).doEnter, playing: getAuthT(language).doEnter };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={playing ? text.playing : label ?? text.idle}
            aria-pressed={playing}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border p-0 leading-none shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 ${playing ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 bg-white text-blue-500 hover:text-blue-600"}`}
        >
            {playing ? (
                <span aria-hidden="true" className="inline-flex h-4 items-center justify-center gap-0.5">
                    <span className="h-2 w-0.5 animate-pulse rounded-full bg-current" />
                    <span className="h-4 w-0.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                    <span className="h-3 w-0.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                </span>
            ) : (
                <svg aria-hidden="true" className="block h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5 6 9H3v6h3l5 4V5Zm4.5 4.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
                </svg>
            )}
        </button>
    );
}
