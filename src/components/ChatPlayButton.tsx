"use client";

type ChatPlayButtonProps = {
    onClick: () => void;
    disabled?: boolean;
    label?: string;
};

export default function ChatPlayButton({
    onClick,
    disabled = false,
    label = "메시지 음성으로 듣기",
}: ChatPlayButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white p-0 leading-none text-blue-500 shadow-sm transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
        >
            <svg
                aria-hidden="true"
                className="block h-4 w-4 translate-x-px"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path d="M8 5v14l11-7z" />
            </svg>
        </button>
    );
}
