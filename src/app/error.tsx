"use client";

import { useEffect } from "react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const ERROR_UI: Record<string, Record<string, string>> = {
    ko: { title:"런타임 오류 발생", desc:"현재 페이지에서 클라이언트 측 오류가 발생했습니다. 아래 상세 오류 메시지를 캡처해서 개발자에게 전달해주세요.", retry:"다시 시도하기" },
    en: { title:"Runtime error", desc:"A client-side error occurred on this page. Capture the detailed error message below and share it with the developer.", retry:"Try again" },
    zh: { title:"发生运行时错误", desc:"此页面发生了客户端错误。请截取下方详细错误信息并发送给开发人员。", retry:"重试" },
    vi: { title:"Đã xảy ra lỗi thời gian chạy", desc:"Đã xảy ra lỗi phía máy khách trên trang này. Hãy chụp thông tin lỗi chi tiết bên dưới và gửi cho nhà phát triển.", retry:"Thử lại" },
    ru: { title:"Ошибка выполнения", desc:"На этой странице произошла клиентская ошибка. Сделайте снимок подробного сообщения ниже и передайте разработчику.", retry:"Повторить" },
};

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const lang = useDisplayLanguage();
    const t = ERROR_UI[lang] || ERROR_UI.en;
    useEffect(() => {
        // 클라이언트 콘솔에도 에러 로깅
        console.error("Uncaught Next.js Client Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#070710] text-white">
            <div className="w-full max-w-md bg-slate-900 border border-red-500/50 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-red-400 mb-2">{t.title}</h2>
                <p className="text-sm text-slate-400 mb-4">
                    {t.desc}
                </p>
                <div className="p-4 bg-black/50 rounded-lg overflow-x-auto text-xs text-red-300 font-mono mb-6 whitespace-pre-wrap word-break">
                    <p className="font-bold">Message: {error.message}</p>
                    <p className="mt-2 text-red-500/80">Stack: {error.stack}</p>
                </div>
                <button
                    onClick={() => reset()}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all"
                >
                    {t.retry}
                </button>
            </div>
        </div>
    );
}
