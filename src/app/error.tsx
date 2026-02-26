"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 클라이언트 콘솔에도 에러 로깅
        console.error("Uncaught Next.js Client Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#070710] text-white">
            <div className="w-full max-w-md bg-slate-900 border border-red-500/50 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-red-400 mb-2">런타임 에러 발생</h2>
                <p className="text-sm text-slate-400 mb-4">
                    현재 페이지에서 클라이언트 측 오류가 발생했습니다.<br />
                    아래 상세 에러 메시지를 캡처해서 개발자(AI)에게 전달해주세요.
                </p>
                <div className="p-4 bg-black/50 rounded-lg overflow-x-auto text-xs text-red-300 font-mono mb-6 whitespace-pre-wrap word-break">
                    <p className="font-bold">Message: {error.message}</p>
                    <p className="mt-2 text-red-500/80">Stack: {error.stack}</p>
                </div>
                <button
                    onClick={() => reset()}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all"
                >
                    다시 시도하기
                </button>
            </div>
        </div>
    );
}
